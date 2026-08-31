// =====================================================================
//  Módulo compartilhado — leitura do certificado A1 (Storage + Vault)
// =====================================================================
// Pasta com "_" no nome: o Vercel não trata isso como uma rota de API,
// só como um módulo importável pelas functions de verdade.

const forge = require('node-forge');

// Ver nota completa em fiscal-sefaz-status.js sobre por que usamos
// node-forge em vez de deixar o Node abrir o PKCS12 direto (OpenSSL 3
// rejeita RC2, comum em certificados ICP-Brasil).
function extrairCertEChavePem(pfxBuffer, senha) {
  const der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!cert) throw new Error('Certificado não contém um certificado X.509 legível.');

  let keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag) keyBag = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  if (!keyBag?.key) throw new Error('Certificado não contém uma chave privada legível.');

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
  };
}

// Autenticação + autorização compartilhada (master/admin ativo) e obtenção
// do client "user" (respeitando RLS) e "admin" (service role).
// Autenticação + autorização compartilhada. Dois caminhos:
//   1) Usuário logado no navegador (JWT do Supabase Auth) — o normal.
//   2) Chamada automática (pg_cron via pg_net) — sem usuário, autentica
//      por segredo compartilhado no header X-Cron-Secret. Usado só pela
//      Etapa 13.8 (automação) — nunca exposto ao navegador.
async function autenticarEAutorizar(req, createClient) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return { erro: { status: 500, body: { error: 'Variáveis de ambiente não configuradas no Vercel.' } } };
  }

  const segredoRecebido = req.headers['x-cron-secret'];
  if (CRON_SECRET && segredoRecebido && segredoRecebido === CRON_SECRET) {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    return { supabaseAdmin, ehCron: true };
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) return { erro: { status: 401, body: { error: 'Não autenticado.' } } };

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: errUser } = await supabaseUser.auth.getUser();
  if (errUser || !user) return { erro: { status: 401, body: { error: 'Sessão inválida.' } } };

  const { data: perfil } = await supabaseUser.from('profiles').select('role, status').eq('id', user.id).maybeSingle();
  const ehAdmin = perfil?.status === 'ativo' && (perfil.role === 'master' || perfil.role === 'admin');
  if (!ehAdmin) return { erro: { status: 403, body: { error: 'Só master/admin podem executar esta ação.' } } };

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  return { user, supabaseAdmin };
}

// Busca o certificado ativo mais recente e devolve cert+chave já em PEM.
async function obterCertificadoAtivo(supabaseAdmin) {
  const { data: cert } = await supabaseAdmin.from('fiscal_certificados').select('*').eq('ativo', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!cert) throw new Error('Nenhum certificado cadastrado ainda.');

  const { data: blob, error: errDownload } = await supabaseAdmin.storage.from('fiscal-certificados').download(cert.arquivo_storage_path);
  if (errDownload) throw new Error('Falha ao ler o certificado do Storage: ' + errDownload.message);
  const pfxBuffer = Buffer.from(await blob.arrayBuffer());

  const { data: senha, error: errSenha } = await supabaseAdmin.rpc('fiscal_vault_ler_segredo', { p_id: cert.senha_secret_id });
  if (errSenha || !senha) throw new Error('Falha ao recuperar a senha do Vault.');

  const { certPem, keyPem } = extrairCertEChavePem(pfxBuffer, senha);
  return { cert, certPem, keyPem };
}

module.exports = { extrairCertEChavePem, autenticarEAutorizar, obterCertificadoAtivo };
