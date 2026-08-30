// =====================================================================
//  FABASI — /api/fiscal-nfse-adn-status  (Etapa 13.7, fase exploratória)
// =====================================================================
//
// ⚠️ CÓDIGO EXPLORATÓRIO, NÃO TESTADO — e com mais incerteza que o
// equivalente de NF-e (fiscal-sefaz-status.js). Motivo: a documentação
// oficial (Swagger) da API do ADN exige certificado mTLS até pra ser
// visualizada — não consegui buscar o schema de resposta real de forma
// nenhuma antes de escrever este código. As URLs abaixo vêm confirmadas
// da página oficial (gov.br/nfse, atualizada em 20/08/2026):
//
//   Produção Restrita (homologação): https://adn.producaorestrita.nfse.gov.br/contribuintes
//   Produção:                        https://adn.nfse.gov.br/contribuintes
//
// O caminho exato dentro de /contribuintes (ex.: /DFe/{ultimoNSU}) veio
// só de relatos de comunidade, não de documentação oficial confirmada —
// por isso esta function, de propósito, NÃO tenta parsear a resposta
// ainda. Ela só faz a chamada e devolve o corpo bruto (JSON ou texto) pra
// a gente ver o formato real antes de escrever qualquer parser — mesma
// estratégia que funcionou bem pra descobrir os detalhes da NF-e.
//
// Diferente da NF-e (SOAP/XML), o ADN é API REST/JSON — não precisa de
// envelope SOAP nem SOAPAction, só GET autenticado por mTLS.
// =====================================================================

const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar, obterCertificadoAtivo } = require('./_lib/certificado');

const BASES = {
  homologacao: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
  producao: 'https://adn.nfse.gov.br/contribuintes',
};

function chamarAdn(url, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    // rejectUnauthorized: false — mesma decisão consciente do fiscal-sefaz-status.js
    // (Node não confia na raiz ICP-Brasil por padrão; ver README para detalhes).
    const agent = new https.Agent({ cert: certPem, key: keyPem, rejectUnauthorized: false });
    const { hostname, pathname, search } = new URL(url);

    const req = https.request({
      hostname, path: pathname + search, method: 'GET', agent,
      headers: { 'Accept': 'application/json' },
      timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('timeout', () => { req.destroy(new Error('Tempo esgotado ao conectar com o ADN.')); });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  try {
    const auth = await autenticarEAutorizar(req, createClient);
    if (auth.erro) { res.status(auth.erro.status).json(auth.erro.body); return; }
    const { supabaseAdmin } = auth;

    let cert, certPem, keyPem;
    try {
      ({ cert, certPem, keyPem } = await obterCertificadoAtivo(supabaseAdmin));
    } catch (e) {
      res.status(422).json({ error: e.message });
      return;
    }

    const ambiente = (req.body?.ambiente === 'producao') ? 'producao' : 'homologacao';
    // Caminho de teste: DFe a partir do NSU 0 — tenta trazer o primeiro
    // lote disponível (ou confirmar "nenhum documento"). Se der 404, o
    // caminho certo pode ser outro — é exatamente o que este teste
    // exploratório serve para descobrir.
    const url = `${BASES[ambiente]}/DFe/0`;

    const inicio = Date.now();
    let resposta;
    try {
      resposta = await chamarAdn(url, certPem, keyPem);
    } catch (e) {
      res.status(502).json({ error: 'Falha de conexão com o ADN: ' + e.message, url_tentada: url });
      return;
    }
    const duracaoMs = Date.now() - inicio;

    await supabaseAdmin.from('fiscal_logs').insert([{
      empresa_id: cert.empresa_id, nivel: 'info',
      mensagem: `Teste exploratório ADN (${ambiente}): HTTP ${resposta.statusCode}`,
      metadados: { url, duracao_ms: duracaoMs, corpo_bruto: resposta.body.slice(0, 4000) },
    }]);

    // Devolve tudo cru de propósito — ainda não sabemos o formato real.
    res.status(200).json({
      ok: true, url_tentada: url, http_status: resposta.statusCode,
      content_type: resposta.headers['content-type'] || null,
      duracao_ms: duracaoMs,
      corpo_bruto: resposta.body.slice(0, 4000),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
