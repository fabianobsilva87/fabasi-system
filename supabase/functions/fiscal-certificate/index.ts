// =====================================================================
//  FABASI — Edge Function: fiscal-certificate  (Etapa 13.2)
// =====================================================================
//
// ⚠️ CÓDIGO NÃO TESTADO EM AMBIENTE REAL — escrito sem acesso a um projeto
// Supabase nem a um certificado A1 de verdade. Antes de confiar nele:
//   1. `supabase functions deploy fiscal-certificate`
//   2. Testar a ação 'cadastrar' em homologação com o certificado real
//   3. Só depois testar 'testar' (que também faz uma chamada de baixo
//      custo à SEFAZ — NfeStatusServico) — ver aviso na seção 5.
//
// O que esta function faz (e por quê tem que ser aqui, nunca no navegador):
//   - Abre o arquivo .pfx/.p12 com a senha informada (nunca expor a senha
//     nem o arquivo ao cliente).
//   - Extrai CNPJ/validade do certificado.
//   - Grava o arquivo em Storage privado e a senha no Supabase Vault.
//   - Registra auditoria de toda ação sensível.
//
// Variáveis de ambiente esperadas (configuradas via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   (as duas primeiras já vêm automaticamente no ambiente da function;
//   SERVICE_ROLE_KEY precisa ser setada manualmente como secret)
// =====================================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
// node-forge é a lib usada pra ler PKCS#12 (mesma citada no doc de
// arquitetura do Fiscal). Roda via camada de compatibilidade npm do Deno.
import forge from 'npm:node-forge@1.3.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── 1. Leitura do certificado (node-forge) ──────────────────────────────
function abrirCertificado(base64: string, senha: string) {
  let asn1;
  try {
    const der = forge.util.decode64(base64);
    asn1 = forge.asn1.fromDer(der);
  } catch (_e) {
    throw new Error('Arquivo não parece ser um certificado .pfx/.p12 válido.');
  }

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch (_e) {
    // node-forge lança erro genérico tanto pra senha errada quanto pra
    // arquivo corrompido — mensagem única e segura pro usuário final.
    throw new Error('Não foi possível utilizar o certificado. Verifique a senha.');
  }

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = bags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error('Certificado não contém um bag de certificado X.509 legível.');

  const cert = certBag.cert;
  const cn = cert.subject.getField('CN')?.value ?? '';
  // e-CNPJ A1 tem CN no formato "RAZAO SOCIAL:14DIGITOSDOCNPJ"
  const match = cn.match(/(\d{14})\s*$/);
  const cnpjCertificado = match ? match[1] : null;

  return {
    cnpjCertificado,
    notBefore: cert.validity.notBefore as Date,
    notAfter: cert.validity.notAfter as Date,
    // chave privada, se precisar assinar XML nas Etapas 13.4/13.7 —
    // mantida só em memória desta invocação, nunca persistida em texto.
    keyBags: p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag }),
  };
}

function limparCNPJ(v: string) {
  return (v || '').toUpperCase().replace(/[.\-/\s]/g, '');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autenticado.' }, 401);

    // Client "do usuário" — respeita RLS, só serve pra confirmar quem é e
    // checar o perfil. Nunca usado para as operações sensíveis abaixo.
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errUser } = await supabaseUser.auth.getUser();
    if (errUser || !user) return jsonResponse({ error: 'Sessão inválida.' }, 401);

    const { data: perfil } = await supabaseUser.from('profiles').select('role, status, nome').eq('id', user.id).maybeSingle();
    const ehAdmin = perfil?.status === 'ativo' && (perfil.role === 'master' || perfil.role === 'admin');
    if (!ehAdmin) return jsonResponse({ error: 'Só master/admin podem gerenciar o certificado fiscal.' }, 403);

    // Client com service role — só a partir daqui tocamos Storage privado,
    // Vault e a tabela fiscal_certificados.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const acao = body?.acao;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    // ── AÇÃO: cadastrar ────────────────────────────────────────────────
    if (acao === 'cadastrar') {
      const { certificado_base64, senha, ambiente_padrao, confirmar_cnpj_diferente } = body;
      if (!certificado_base64 || !senha) return jsonResponse({ error: 'Envie certificado_base64 e senha.' }, 400);

      let info;
      try {
        info = abrirCertificado(certificado_base64, senha);
      } catch (e) {
        return jsonResponse({ error: (e as Error).message }, 422);
      }

      const { data: master } = await supabaseAdmin.from('empresa_master').select('id, cnpj').limit(1).maybeSingle();
      if (master?.cnpj && info.cnpjCertificado && limparCNPJ(master.cnpj) !== info.cnpjCertificado) {
        if (!confirmar_cnpj_diferente) {
          return jsonResponse({
            error: 'cnpj_diferente',
            mensagem: `O CNPJ do certificado (${info.cnpjCertificado}) é diferente do CNPJ cadastrado em Empresa Master (${master.cnpj}). Confirme explicitamente se isso é esperado.`,
          }, 409);
        }
      }

      // 1) Storage privado
      const path = `${master?.id ?? 'sem-empresa'}/certificado_${Date.now()}.pfx`;
      const bytes = Uint8Array.from(atob(certificado_base64), c => c.charCodeAt(0));
      const { error: errUpload } = await supabaseAdmin.storage.from('fiscal-certificados').upload(path, bytes, {
        contentType: 'application/x-pkcs12',
        upsert: false,
      });
      if (errUpload) return jsonResponse({ error: 'Falha ao salvar o certificado: ' + errUpload.message }, 500);

      // 2) Vault — senha nunca em coluna de tabela
      const { data: secretId, error: errVault } = await supabaseAdmin.rpc('fiscal_vault_criar_segredo', {
        p_secret: senha,
        p_name: `fiscal_cert_${Date.now()}`,
      });
      if (errVault) return jsonResponse({ error: 'Falha ao salvar a senha no Vault: ' + errVault.message }, 500);

      const status = info.notAfter < new Date() ? 'expirado' : 'nao_testado';

      const { data: novoCert, error: errInsert } = await supabaseAdmin.from('fiscal_certificados').insert([{
        empresa_id: master?.id ?? null,
        cnpj_certificado: info.cnpjCertificado,
        arquivo_storage_path: path,
        senha_secret_id: secretId,
        data_inicio_validade: info.notBefore.toISOString().slice(0, 10),
        data_expiracao: info.notAfter.toISOString().slice(0, 10),
        status,
        ambiente_padrao: ambiente_padrao === 'producao' ? 'producao' : 'homologacao',
      }]).select('id, cnpj_certificado, status, ambiente_padrao, data_expiracao').single();
      if (errInsert) return jsonResponse({ error: 'Falha ao registrar certificado: ' + errInsert.message }, 500);

      await supabaseAdmin.from('fiscal_certificado_auditoria').insert([{
        certificado_id: novoCert.id, usuario_id: user.id, acao: 'cadastrado',
        detalhe: { cnpj_certificado: info.cnpjCertificado, status }, ip,
      }]);

      return jsonResponse({ certificado: novoCert });
    }

    // ── AÇÃO: testar ───────────────────────────────────────────────────
    if (acao === 'testar') {
      const { certificado_id } = body;
      const { data: cert } = await supabaseAdmin.from('fiscal_certificados').select('*').eq('id', certificado_id).maybeSingle();
      if (!cert) return jsonResponse({ error: 'Certificado não encontrado.' }, 404);

      const { data: fileBlob, error: errDownload } = await supabaseAdmin.storage.from('fiscal-certificados').download(cert.arquivo_storage_path);
      if (errDownload) return jsonResponse({ error: 'Falha ao ler o certificado do Storage: ' + errDownload.message }, 500);

      const senha = await supabaseAdmin.rpc('fiscal_vault_ler_segredo', { p_id: cert.senha_secret_id });
      if (senha.error || !senha.data) return jsonResponse({ error: 'Falha ao recuperar a senha do Vault.' }, 500);

      const base64 = btoa(String.fromCharCode(...new Uint8Array(await fileBlob.arrayBuffer())));

      let info;
      try {
        info = abrirCertificado(base64, senha.data);
      } catch (e) {
        await supabaseAdmin.from('fiscal_certificados').update({ status: 'invalido', data_ultimo_teste: new Date().toISOString() }).eq('id', certificado_id);
        await supabaseAdmin.from('fiscal_certificado_auditoria').insert([{ certificado_id, usuario_id: user.id, acao: 'testado', detalhe: { resultado: 'falhou', erro: (e as Error).message }, ip }]);
        return jsonResponse({ error: (e as Error).message }, 422);
      }

      // ⚠️ TRECHO NÃO VALIDADO — chamada mTLS ao NFeStatusServico da SEFAZ.
      // Deixado comentado de propósito: Deno.createHttpClient com certChain/
      // privateKey precisa ser testado com cautela em homologação antes de
      // habilitar de verdade (consome, mesmo que pouco, cota de SEFAZ).
      // Depois de validar as etapas acima (abrir o certificado de novo bate
      // certo), descomente e ajuste o endpoint conforme a UF/ambiente:
      //
      // const httpClient = Deno.createHttpClient({
      //   certChain: forge.pki.certificateToPem(certBagCert),
      //   privateKey: forge.pki.privateKeyToPem(keyBagPrivateKey),
      // });
      // const resp = await fetch(URL_NFE_STATUS_SERVICO[uf][ambiente], {
      //   client: httpClient, method: 'POST', headers: {...}, body: envelopeSoap,
      // });

      const status = info.notAfter < new Date() ? 'expirado' : 'valido';
      await supabaseAdmin.from('fiscal_certificados').update({ status, data_ultimo_teste: new Date().toISOString() }).eq('id', certificado_id);
      await supabaseAdmin.from('fiscal_certificado_auditoria').insert([{ certificado_id, usuario_id: user.id, acao: 'testado', detalhe: { resultado: 'ok', status }, ip }]);

      return jsonResponse({ status, data_expiracao: info.notAfter.toISOString().slice(0, 10), aviso: 'Chamada de baixo custo à SEFAZ (NFeStatusServico) ainda não habilitada nesta function — ver comentário no código.' });
    }

    // ── AÇÃO: remover (soft delete — nunca apaga Storage/Vault de fato) ──
    if (acao === 'remover') {
      const { certificado_id } = body;
      const { error } = await supabaseAdmin.from('fiscal_certificados').update({ ativo: false }).eq('id', certificado_id);
      if (error) return jsonResponse({ error: error.message }, 500);
      await supabaseAdmin.from('fiscal_certificado_auditoria').insert([{ certificado_id, usuario_id: user.id, acao: 'removido', detalhe: {}, ip }]);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    console.error('fiscal-certificate:', e);
    return jsonResponse({ error: 'Erro interno: ' + (e as Error).message }, 500);
  }
});
