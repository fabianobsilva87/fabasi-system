// =====================================================================
//  Módulo compartilhado — parser dos documentos retornados pelo distNSU
// =====================================================================
// O distNSU pode devolver 4 tipos de documento (schema attr do docZip):
//   resNFe          — resumo (sem itens)
//   procNFe         — NFe completa (com itens) — mesma estrutura que o
//                      parser client-side da Etapa 13.3 já lê
//   resEvento       — resumo de evento (cancelamento, ciência, etc.)
//   procEventoNFe   — evento completo
// Reaproveita a mesma lógica de extração de itens/impostos do parser
// client-side (fiscal-documentos.html), só trocando DOMParser (browser)
// por @xmldom/xmldom (Node) — a API é praticamente idêntica.

const { DOMParser } = require('@xmldom/xmldom');

function limparCNPJ(v) {
  return (v || '').toUpperCase().replace(/[.\-/\s]/g, '');
}

function xmlTexto(el, tag) {
  if (!el) return null;
  const nodes = el.getElementsByTagName(tag);
  const node = nodes && nodes.length ? nodes[0] : null;
  return node ? node.textContent.trim() : null;
}

function filhosParaObjeto(el) {
  if (!el || !el.childNodes || !el.childNodes.length) return null;
  const bloco = Array.from(el.childNodes).find(n => n.nodeType === 1); // primeiro elemento filho
  if (!bloco) return null;
  const obj = { _bloco: bloco.tagName };
  Array.from(bloco.childNodes).filter(n => n.nodeType === 1).forEach(c => { obj[c.tagName] = c.textContent.trim(); });
  return obj;
}

// Detecta o tipo a partir do atributo "schema" do docZip (ex.: "resNFe_v1.01.xsd")
function detectarTipoDocumento(schemaAttr, doc) {
  const s = (schemaAttr || '').toLowerCase();
  if (s.includes('procnfe') || doc.getElementsByTagName('infNFe').length) return 'procNFe';
  if (s.includes('resnfe')) return 'resNFe';
  if (s.includes('proceventonfe')) return 'procEventoNFe';
  if (s.includes('resevento')) return 'resEvento';
  return 'desconhecido';
}

function parseResNFe(doc) {
  const el = doc.getElementsByTagName('resNFe')[0];
  return {
    tipo_documento: 'NFE',
    chave_acesso: xmlTexto(el, 'chNFe'),
    cnpj_emitente: limparCNPJ(xmlTexto(el, 'CNPJ') || ''),
    data_emissao: xmlTexto(el, 'dhEmi'),
    valor_total: Number(xmlTexto(el, 'vNF')) || 0,
    protocolo: xmlTexto(el, 'nProt'),
    _emitente_nome: xmlTexto(el, 'xNome'),
    _emitente_endereco: null,
    ambiente: 'homologacao', // sobrescrito pelo chamador
    itens: [], // resNFe não traz itens — só resumo
    _resumo: true,
  };
}

function parseProcNFe(doc) {
  const ide = doc.getElementsByTagName('ide')[0];
  const emit = doc.getElementsByTagName('emit')[0];
  const dest = doc.getElementsByTagName('dest')[0];
  const total = doc.getElementsByTagName('ICMSTot')[0];
  const infNFe = doc.getElementsByTagName('infNFe')[0];
  const protNFe = doc.getElementsByTagName('protNFe')[0];

  const idAttr = infNFe?.getAttribute('Id') || '';
  const chaveAcesso = idAttr.replace(/\D/g, '').slice(-44) || xmlTexto(protNFe, 'chNFe');

  const enderEmit = emit?.getElementsByTagName('enderEmit')[0];

  const itens = Array.from(doc.getElementsByTagName('det')).map(det => {
    const prod = det.getElementsByTagName('prod')[0];
    const imposto = det.getElementsByTagName('imposto')[0];
    return {
      numero_item: Number(det.getAttribute('nItem')) || null,
      codigo_produto: xmlTexto(prod, 'cProd'),
      descricao_original: xmlTexto(prod, 'xProd'),
      ncm: xmlTexto(prod, 'NCM'),
      cfop: xmlTexto(prod, 'CFOP'),
      unidade: xmlTexto(prod, 'uCom'),
      quantidade: Number(xmlTexto(prod, 'qCom')) || null,
      valor_unitario: Number(xmlTexto(prod, 'vUnCom')) || null,
      valor_total: Number(xmlTexto(prod, 'vProd')) || null,
      desconto: Number(xmlTexto(prod, 'vDesc')) || 0,
      frete: Number(xmlTexto(prod, 'vFrete')) || 0,
      outras_despesas: Number(xmlTexto(prod, 'vOutro')) || 0,
      icms: filhosParaObjeto(imposto?.getElementsByTagName('ICMS')[0]),
      ipi: filhosParaObjeto(imposto?.getElementsByTagName('IPI')[0]),
      pis: filhosParaObjeto(imposto?.getElementsByTagName('PIS')[0]),
      cofins: filhosParaObjeto(imposto?.getElementsByTagName('COFINS')[0]),
      status_classificacao: 'pendente',
    };
  });

  return {
    tipo_documento: 'NFE',
    modelo: xmlTexto(ide, 'mod'),
    serie: xmlTexto(ide, 'serie'),
    numero: xmlTexto(ide, 'nNF'),
    chave_acesso: chaveAcesso,
    data_emissao: xmlTexto(ide, 'dhEmi') || xmlTexto(ide, 'dEmi'),
    cnpj_emitente: limparCNPJ(xmlTexto(emit, 'CNPJ') || ''),
    cnpj_destinatario: limparCNPJ(xmlTexto(dest, 'CNPJ') || ''),
    valor_total: Number(xmlTexto(total, 'vNF')) || 0,
    protocolo: xmlTexto(protNFe, 'nProt'),
    _emitente_nome: xmlTexto(emit, 'xNome'),
    _emitente_endereco: enderEmit ? {
      logradouro: xmlTexto(enderEmit, 'xLgr'), numero: xmlTexto(enderEmit, 'nro'),
      bairro: xmlTexto(enderEmit, 'xBairro'), municipio: xmlTexto(enderEmit, 'xMun'), uf: xmlTexto(enderEmit, 'UF'),
    } : null,
    itens,
    _resumo: false,
  };
}

function parseEvento(doc, tipo) {
  // resEvento e procEventoNFe têm estrutura parecida o bastante pra usar
  // a mesma extração — campos que não existirem ficam null.
  const infEvento = doc.getElementsByTagName('infEvento')[0] || doc.getElementsByTagName('resEvento')[0];
  return {
    chave_acesso: xmlTexto(infEvento, 'chNFe'),
    tipo_evento: xmlTexto(infEvento, 'tpEvento'),
    descricao: xmlTexto(infEvento, 'xEvento') || xmlTexto(infEvento, 'descEvento'),
    data_evento: xmlTexto(infEvento, 'dhEvento'),
    sequencia: Number(xmlTexto(infEvento, 'nSeqEvento')) || 1,
    protocolo: xmlTexto(infEvento, 'nProt'),
  };
}

// Ponto de entrada: recebe o XML cru (já descompactado) de um docZip e
// devolve { tipo: 'documento'|'evento'|'desconhecido', dados }.
function parseDocZip(xmlTexto2, schemaAttr) {
  const doc = new DOMParser().parseFromString(xmlTexto2, 'text/xml');
  const tipo = detectarTipoDocumento(schemaAttr, doc);

  if (tipo === 'resNFe') return { tipo: 'documento', dados: parseResNFe(doc) };
  if (tipo === 'procNFe') return { tipo: 'documento', dados: parseProcNFe(doc) };
  if (tipo === 'resEvento' || tipo === 'procEventoNFe') return { tipo: 'evento', dados: parseEvento(doc, tipo) };
  return { tipo: 'desconhecido', dados: null };
}

module.exports = { parseDocZip, limparCNPJ };
