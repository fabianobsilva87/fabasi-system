// =====================================================================
//  FABASI — /api/fiscal-sefaz-status  (Etapa 13.4, parte 1: NFeStatusServico)
// =====================================================================
//
// ✅ VALIDADO em homologação em 30/08/2026 — cStat=107 ("Serviço em
// Operação"). Ver api/README.md para o histórico completo de problemas
// resolvidos no caminho (PKCS12/OpenSSL, cadeia ICP-Brasil, XML compacto).
//
// Endpoints confirmados via nfephp-org/sped-nfe:
//   Homologação: https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4
//   Produção:    https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4
// cUF do Mato Grosso = 51 (código IBGE).
// =====================================================================

const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar, obterCertificadoAtivo } = require('./_lib/certificado');
const { chamarComCertificado, extrairTag } = require('./_lib/sefaz-http');

const ENDPOINTS = {
  homologacao: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
  producao: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4',
};
const CUF_MT = '51';
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF';

function montarEnvelopeSoap(ambiente) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  // A SEFAZ rejeita (cStat 588) qualquer espaço/quebra de linha entre as
  // tags da mensagem — precisa ser compacto, sem indentação nenhuma.
  const consStatServ = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${CUF_MT}</cUF><xServ>STATUS</xServ></consStatServ>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">${consStatServ}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
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
    const url = ENDPOINTS[ambiente];
    const envelope = montarEnvelopeSoap(ambiente);

    const inicio = Date.now();
    const resposta = await chamarComCertificado(url, envelope, certPem, keyPem, SOAP_ACTION);
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
