// =====================================================================
//  FABASI — /api/fiscal-sefaz-status  (Etapa 13.4, parte 1: NFeStatusServico)
// =====================================================================
//
// ⚠️ CÓDIGO NÃO TESTADO EM AMBIENTE REAL.
//
// POR QUE ISTO É UMA VERCEL FUNCTION E NÃO UMA SUPABASE EDGE FUNCTION:
// Deno (o runtime das Edge Functions do Supabase) não tem suporte estável
// pra certificado cliente (mTLS) em requisições HTTPS — é uma limitação
// documentada e, até onde pesquisei, ainda sem solução confiável. Node.js
// puro resolve isso nativamente: https.Agent aceita { pfx, passphrase }
// direto, sem nem precisar converter pra PEM. Como o Fabasi já roda no
// Vercel, uma Serverless Function aqui (runtime Node.js de verdade) é o
// caminho mais simples — sem precisar de infraestrutura nova.
//
// O que esta function faz: consulta NFeStatusServico4 da SEFAZ-MT — uma
// chamada de BAIXÍSSIMO CUSTO que não consome cota de distribuição (distNSU),
// só confirma que a autenticação mTLS com o certificado funciona de verdade.
// Isso é deliberadamente o primeiro teste, antes de implementar o distNSU
// de verdade (Etapa 13.4 completa), que é mais arriscado (pode gerar
// bloqueio de 1h por "consumo indevido" se usado errado).
//
// Endpoints confirmados via nfephp-org/sped-nfe (referência mantida pela
// comunidade de desenvolvedores de NF-e no Brasil) — MT tem webservice
// próprio, não usa SVRS/SVAN como autorizador principal:
//   Homologação: https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4
//   Produção:    https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4
// cUF do Mato Grosso = 51 (código IBGE).
//
// Variáveis de ambiente necessárias no Vercel (Project Settings → Environment
// Variables) — diferente das Edge Functions do Supabase, o Vercel NÃO injeta
// nada automaticamente:
//   SUPABASE_URL              (mesmo valor público de config.js)
//   SUPABASE_ANON_KEY         (mesmo valor público de config.js)
//   SUPABASE_SERVICE_ROLE_KEY (secreta — Project Settings → API no Supabase)
// =====================================================================

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const forge = require('node-forge');

const ENDPOINTS = {
  homologacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
  producao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
};
const CUF_MT = '51';

// O Node 17+ usa OpenSSL 3, que rejeita por padrão PKCS12 cifrados com RC2
// (algoritmo legado, mas ainda muito comum em certificados A1 emitidos por
// autoridades certificadoras ICP-Brasil) — daí o erro "Unsupported PKCS12
// PFX data" ao passar { pfx, passphrase } direto pro https.Agent. Usamos
// node-forge (implementação pura em JS, não depende do OpenSSL do sistema)
// pra extrair certificado e chave privada como PEM — o Node não tem
// nenhum problema em usar PEM depois, só em interpretar o PKCS12 bruto.
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

function montarEnvelopeSoap(ambiente) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${tpAmb}</tpAmb>
        <cUF>${CUF_MT}</cUF>
        <xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

function chamarSefazComCertificado(url, envelope, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ cert: certPem, key: keyPem });
    const body = Buffer.from(envelope, 'utf-8');
    const { hostname, pathname, search } = new URL(url);

    const req = https.request({
      hostname,
      path: pathname + search,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
        'Content-Length': body.length,
      },
      timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('timeout', () => { req.destroy(new Error('Tempo esgotado ao conectar com a SEFAZ.')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Variáveis de ambiente não configuradas no Vercel (ver comentário no topo do arquivo api/fiscal-sefaz-status.js).' });
      return;
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) { res.status(401).json({ error: 'Não autenticado.' }); return; }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: errUser } = await supabaseUser.auth.getUser();
    if (errUser || !user) { res.status(401).json({ error: 'Sessão inválida.' }); return; }

    const { data: perfil } = await supabaseUser.from('profiles').select('role, status').eq('id', user.id).maybeSingle();
    const ehAdmin = perfil?.status === 'ativo' && (perfil.role === 'master' || perfil.role === 'admin');
    if (!ehAdmin) { res.status(403).json({ error: 'Só master/admin podem testar a conexão com a SEFAZ.' }); return; }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: cert } = await supabaseAdmin.from('fiscal_certificados').select('*').eq('ativo', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!cert) { res.status(404).json({ error: 'Nenhum certificado cadastrado ainda.' }); return; }

    const { data: blob, error: errDownload } = await supabaseAdmin.storage.from('fiscal-certificados').download(cert.arquivo_storage_path);
    if (errDownload) { res.status(500).json({ error: 'Falha ao ler o certificado do Storage: ' + errDownload.message }); return; }
    const pfxBuffer = Buffer.from(await blob.arrayBuffer());

    const { data: senha, error: errSenha } = await supabaseAdmin.rpc('fiscal_vault_ler_segredo', { p_id: cert.senha_secret_id });
    if (errSenha || !senha) { res.status(500).json({ error: 'Falha ao recuperar a senha do Vault.' }); return; }

    let certPem, keyPem;
    try {
      ({ certPem, keyPem } = extrairCertEChavePem(pfxBuffer, senha));
    } catch (e) {
      res.status(422).json({ error: 'Falha ao interpretar o certificado: ' + e.message });
      return;
    }

    const ambiente = (req.body?.ambiente === 'producao') ? 'producao' : 'homologacao';
    const url = ENDPOINTS[ambiente];
    const envelope = montarEnvelopeSoap(ambiente);

    const inicio = Date.now();
    const resposta = await chamarSefazComCertificado(url, envelope, certPem, keyPem);
    const duracaoMs = Date.now() - inicio;

    const cStat = extrairTag(resposta.body, 'cStat');
    const xMotivo = extrairTag(resposta.body, 'xMotivo');
    const dhRecbto = extrairTag(resposta.body, 'dhRecbto');
    const tMed = extrairTag(resposta.body, 'tMed');

    await supabaseAdmin.from('fiscal_logs').insert([{
      empresa_id: cert.empresa_id, nivel: cStat === '107' ? 'info' : 'aviso',
      mensagem: `NFeStatusServico (${ambiente}): cStat=${cStat} xMotivo=${xMotivo}`,
      metadados: { ambiente, http_status: resposta.statusCode, duracao_ms: duracaoMs },
    }]);

    if (!cStat) {
      res.status(502).json({
        error: 'A SEFAZ respondeu, mas não consegui achar <cStat> no XML — layout de resposta pode ser diferente do esperado.',
        http_status: resposta.statusCode,
        corpo_bruto: resposta.body.slice(0, 2000),
      });
      return;
    }

    res.status(200).json({
      ok: true, ambiente, cStat, xMotivo, dhRecbto, tMed, duracao_ms: duracaoMs,
      servico_em_operacao: cStat === '107',
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
