// =====================================================================
//  FABASI — /api/fiscal-manifestar-nfe (Manifestação do Destinatário)
// =====================================================================
//
// ⚠️ PEÇA MAIS SENSÍVEL DO MÓDULO FISCAL ATÉ AGORA. Diferente do distNSU
// e do NFeStatusServico (que só autenticam por mTLS), este evento precisa
// de ASSINATURA DIGITAL XML (padrão W3C XML-DSig, subconjunto específico
// que a NF-e exige: RSA-SHA1, C14N padrão — não exclusive —, transform
// enveloped-signature). Confirmado via múltiplas fontes independentes
// (documentação oficial replicada por SEFAZ estaduais, projeto nfephp-org)
// antes de escrever este código — mas ainda assim é o tipo de coisa que
// só se confirma 100% testando contra a SEFAZ de verdade.
//
// ✅ CONFIRMADO: endpoints nacionais (mesmo domínio nfe.fazenda.gov.br do
// distNSU, sofreu a MESMA troca hom → hom1 em 23/05/2022):
//   Homologação: https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx
//   Produção:    https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx
//
// Códigos de evento (Manifestação do Destinatário):
//   210200 Confirmação da Operação   210210 Ciência da Operação (o padrão
//   aqui, escolhido no chat) 210220 Desconhecimento 210240 Operação não
//   Realizada (exige justificativa, mín. 15 caracteres — não implementado
//   nesta primeira entrega, só Ciência).
//
// A assinatura foi TESTADA isoladamente (perfil RSA-SHA1/C14N/enveloped
// confirmado batendo) antes deste código ser escrito. Ainda assim,
// teste em homologação primeiro.
// =====================================================================

const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');
const forge = require('node-forge');
const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar, obterCertificadoAtivo } = require('./_lib/certificado');
const { chamarComCertificado, extrairTag } = require('./_lib/sefaz-http');

const ENDPOINTS = {
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  producao: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
};
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

const DESCRICAO_EVENTO = {
  '210200': 'Confirmacao da Operacao',
  '210210': 'Ciencia da Operacao',
  '210220': 'Desconhecimento da Operacao',
  '210240': 'Operacao nao Realizada',
};

function formatarDataHoraNFe() {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dataLocal = new Date(agora.getTime() - 3 * 3600 * 1000);
  return `${agora.getUTCFullYear()}-${pad(agora.getUTCMonth() + 1)}-${pad(agora.getUTCDate())}T${pad(dataLocal.getUTCHours())}:${pad(agora.getUTCMinutes())}:${pad(agora.getUTCSeconds())}-03:00`;
}

function montarInfEvento({ ambiente, cnpj, chaveAcesso, tpEvento, nSeqEvento }) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const dhEvento = formatarDataHoraNFe();
  const seqPad = String(nSeqEvento).padStart(2, '0');
  const id = `ID${tpEvento}${chaveAcesso}${seqPad}`;
  const descEvento = DESCRICAO_EVENTO[tpEvento] || 'Evento';

  const infEvento =
    `<infEvento Id="${id}">` +
    `<cOrgao>91</cOrgao>` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${chaveAcesso}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento>` +
    `<tpEvento>${tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00">` +
    `<descEvento>${descEvento}</descEvento>` +
    `</detEvento>` +
    `</infEvento>`;

  return { infEvento, id };
}

function assinarInfEvento(infEventoXml, certPem, keyPem) {
  const certForge = forge.pki.certificateFromPem(certPem);
  const certDerB64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(certForge)).getBytes());

  const sig = new SignedXml({ privateKey: keyPem });
  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  sig.getKeyInfoContent = () => `<X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data>`;

  sig.computeSignature(infEventoXml);
  return sig.getSignedXml();
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

    const { documento_id, tipo_evento } = req.body || {};
    if (!documento_id) { res.status(400).json({ error: 'documento_id é obrigatório.' }); return; }
    const tpEvento = tipo_evento || '210210';
    if (!DESCRICAO_EVENTO[tpEvento]) { res.status(400).json({ error: 'tipo_evento inválido.' }); return; }

    const { data: doc, error: errDoc } = await supabaseAdmin.from('fiscal_documentos').select('*').eq('id', documento_id).single();
    if (errDoc || !doc) { res.status(404).json({ error: 'Documento não encontrado.' }); return; }
    if (!doc.chave_acesso) { res.status(422).json({ error: 'Este documento não tem chave de acesso registrada — não é possível manifestar.' }); return; }
    if (doc.manifestacao_status === 'ciencia_confirmada') { res.status(409).json({ error: 'Este documento já foi manifestado (Ciência confirmada).' }); return; }

    let cert, certPem, keyPem;
    try {
      ({ cert, certPem, keyPem } = await obterCertificadoAtivo(supabaseAdmin));
    } catch (e) {
      res.status(422).json({ error: e.message });
      return;
    }

    const cnpjCertificado = (cert.cnpj_certificado || '').replace(/\D/g, '');
    if (!cnpjCertificado) { res.status(422).json({ error: 'Certificado sem CNPJ registrado.' }); return; }

    const ambiente = (doc.ambiente === 'producao') ? 'producao' : 'homologacao';
    const { infEvento } = montarInfEvento({
      ambiente, cnpj: cnpjCertificado, chaveAcesso: doc.chave_acesso, tpEvento, nSeqEvento: 1,
    });

    let infEventoAssinado;
    try {
      infEventoAssinado = assinarInfEvento(infEvento, certPem, keyPem);
    } catch (e) {
      res.status(500).json({ error: 'Falha ao assinar o evento: ' + e.message });
      return;
    }

    const idLote = String(Date.now()).slice(-15);
    const envEvento =
      `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<idLote>${idLote}</idLote>` +
      `<evento versao="1.00">${infEventoAssinado}</evento>` +
      `</envEvento>`;

    const envelope =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Body>` +
      `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEvento}</nfeDadosMsg>` +
      `</soap12:Body>` +
      `</soap12:Envelope>`;

    const url = ENDPOINTS[ambiente];
    let resposta;
    try {
      resposta = await chamarComCertificado(url, envelope, certPem, keyPem, SOAP_ACTION);
    } catch (e) {
      res.status(502).json({ error: 'Falha de conexão com a SEFAZ: ' + e.message, url_tentada: url });
      return;
    }

    const cStat = extrairTag(resposta.body, 'cStat');
    const xMotivo = extrairTag(resposta.body, 'xMotivo');
    const nProt = extrairTag(resposta.body, 'nProt');

    await supabaseAdmin.from('fiscal_logs').insert([{
      empresa_id: cert.empresa_id, nivel: cStat === '135' ? 'info' : 'erro',
      mensagem: `Manifestação (${tpEvento}) doc ${documento_id}: HTTP ${resposta.statusCode}, cStat=${cStat} ${xMotivo}`,
      metadados: { url, corpo_bruto: resposta.body.slice(0, 4000) },
    }]);

    const sucesso = cStat === '135';
    await supabaseAdmin.from('fiscal_documentos').update({
      manifestacao_status: sucesso ? 'ciencia_confirmada' : 'erro',
      manifestacao_em: new Date().toISOString(),
      manifestacao_protocolo: nProt || null,
    }).eq('id', documento_id);

    if (!sucesso) {
      res.status(502).json({ error: `SEFAZ retornou cStat=${cStat}: ${xMotivo}`, corpo_bruto: resposta.body.slice(0, 2000) });
      return;
    }

    res.status(200).json({
      ok: true, cStat, xMotivo, protocolo: nProt,
      aviso: 'Manifestação registrada. O XML completo (com itens) só aparece numa sincronização seguinte do distNSU — pode levar alguns minutos.',
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
