// =====================================================================
//  FABASI — /api/fiscal-nfse-reprocessar (correção pontual, uso único)
// =====================================================================
//
// Corrige documentos NFS-e que já foram salvos com campos vazios (CNPJ,
// valor, número, data) porque o parser antigo não interpretava o XML
// dentro de ArquivoXml — só olhava campos que não existiam no nível do
// lote. O parser já foi corrigido em fiscal-nfse-adn-sync.js; esta
// function só re-processa o que JÁ FOI SALVO ANTES da correção, usando o
// lote bruto que ficou registrado em fiscal_logs (nunca se perdeu,
// exatamente por causa do log defensivo da primeira versão).
//
// Não precisa ficar agendada nem rodar de novo — é uma correção pontual.
// =====================================================================

const zlib = require('zlib');
const crypto = require('crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar } = require('./_lib/certificado');
const { limparCNPJ } = require('./_lib/parser-distnsu');

function extrairXmlDoItem(item) {
  const candidatos = ['ArquivoXml', 'Xml', 'ConteudoXml', 'DocumentoXml'];
  for (const campo of candidatos) {
    if (item[campo]) {
      try { return zlib.gunzipSync(Buffer.from(item[campo], 'base64')).toString('utf-8'); }
      catch (_e) {
        try { return Buffer.from(item[campo], 'base64').toString('utf-8'); }
        catch (_e2) { return null; }
      }
    }
  }
  return null;
}

function parseNFSeXml(xml) {
  if (!xml) return null;
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const pegarTexto = (elemento, tag) => {
      if (!elemento) return null;
      const els = elemento.getElementsByTagName(tag);
      return els.length ? els[0].textContent : null;
    };
    const infNFSe = doc.getElementsByTagName('infNFSe')[0];
    const emit = doc.getElementsByTagName('emit')[0];
    const valoresTopo = infNFSe ? infNFSe.getElementsByTagName('valores')[0] : null;
    const infDPS = doc.getElementsByTagName('infDPS')[0];
    return {
      identificador: infNFSe ? infNFSe.getAttribute('Id') : null,
      numero: pegarTexto(infNFSe, 'nNFSe'),
      cnpjPrestador: pegarTexto(emit, 'CNPJ'),
      razaoSocialPrestador: pegarTexto(emit, 'xNome'),
      valorTotal: pegarTexto(valoresTopo, 'vLiq'),
      dataEmissao: pegarTexto(infDPS, 'dhEmi'),
    };
  } catch (_e) {
    return null;
  }
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

    const { data: logs, error: errLogs } = await supabaseAdmin
      .from('fiscal_logs')
      .select('metadados')
      .ilike('mensagem', '%LoteDFe%')
      .not('metadados->lote_bruto', 'is', null);

    if (errLogs) { res.status(500).json({ error: 'Erro ao buscar logs: ' + errLogs.message }); return; }
    if (!logs || !logs.length) { res.status(200).json({ ok: true, corrigidos: 0, aviso: 'Nenhum log com lote bruto encontrado.' }); return; }

    let corrigidos = 0, naoEncontrados = 0, erros = 0;
    const detalhes = [];

    for (const log of logs) {
      let itens;
      try { itens = JSON.parse(log.metadados.lote_bruto); }
      catch (_e) { continue; }
      if (!Array.isArray(itens)) continue;

      for (const item of itens) {
        try {
          const xml = extrairXmlDoItem(item);
          const dados = parseNFSeXml(xml);
          if (!dados) continue;

          const chaveAcesso = dados.identificador || item.ChaveAcesso || null;
          const hashXml = xml ? crypto.createHash('sha256').update(xml, 'utf-8').digest('hex') : null;
          if (!chaveAcesso && !hashXml) continue;

          let query = supabaseAdmin.from('fiscal_documentos').select('id, cnpj_emitente').eq('tipo_documento', 'NFSE');
          query = chaveAcesso ? query.eq('nfse_identificador', chaveAcesso) : query.eq('hash_xml', hashXml);
          const { data: existente } = await query.maybeSingle();

          if (!existente) { naoEncontrados++; continue; }
          if (existente.cnpj_emitente) continue;

          const cnpjPrestador = limparCNPJ(dados.cnpjPrestador || '');
          const valor = Number(dados.valorTotal || 0);
          const dataEmissao = dados.dataEmissao ? new Date(dados.dataEmissao).toISOString() : null;

          const { error: errUpdate } = await supabaseAdmin.from('fiscal_documentos').update({
            cnpj_emitente: cnpjPrestador || null, numero: dados.numero || null,
            data_emissao: dataEmissao, valor_total: valor, status: 'processada',
          }).eq('id', existente.id);

          if (errUpdate) { erros++; detalhes.push(`${existente.id}: ${errUpdate.message}`); continue; }

          if (cnpjPrestador) {
            const { data: fornExistente } = await supabaseAdmin.from('fornecedores').select('id').eq('cnpj', cnpjPrestador).maybeSingle();
            if (!fornExistente) {
              await supabaseAdmin.from('fornecedores').insert([{
                razao_social: dados.razaoSocialPrestador || cnpjPrestador, cnpj: cnpjPrestador,
                origem_cadastro: 'pre_cadastro_fiscal', status_pre_cadastro: 'aguardando_confirmacao', ativo: true,
              }]);
            }
          }
          corrigidos++;
        } catch (e) {
          erros++; detalhes.push(e.message);
        }
      }
    }

    res.status(200).json({ ok: true, corrigidos, nao_encontrados: naoEncontrados, erros, detalhes: detalhes.slice(0, 10) });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
