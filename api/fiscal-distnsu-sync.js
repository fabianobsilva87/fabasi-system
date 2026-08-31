// =====================================================================
//  FABASI — /api/fiscal-distnsu-sync  (Etapa 13.4 completa: distNSU)
// =====================================================================
//
// ⚠️ CÓDIGO NÃO TESTADO CONTRA DOCUMENTOS REAIS — a mecânica mTLS/envelope
// já foi validada via fiscal-sefaz-status.js (mesmo certificado, mesmo
// tipo de conexão), mas esta function nunca rodou contra o distNSU de
// verdade. Teste com cautela: comece em homologação, e ESPERE o retorno
// antes de rodar de novo (ver regra do NSU abaixo) — reconsultar sem
// necessidade pode travar o acesso por 1h.
//
// REGRA CRÍTICA DO distNSU (rejeição 656 — "consumo indevido"):
// se a última consulta retornou ultNSU == maxNSU (nada de novo), esta
// function PRECISA esperar 1h de verdade antes de consultar de novo.
// Isso já está implementado abaixo via fiscal_sync_state.proxima_tentativa_permitida
// — mas se você chamar esta function fora do fluxo normal (ex.: via curl
// direto, ignorando o fiscal_sync_state), pode acionar o bloqueio.
//
// Endpoint é NACIONAL (Ambiente Nacional), não por estado — diferente do
// NfeStatusServico. Confirmado via nfephp-org/sped-nfe:
//   Homologação: https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
//   Produção:    https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
// Não precisa de assinatura digital na requisição (só mTLS) — diferente
// do que o documento de arquitetura original supunha.
// =====================================================================

const zlib = require('zlib');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar, obterCertificadoAtivo } = require('./_lib/certificado');
const { chamarComCertificado } = require('./_lib/sefaz-http');
const { parseDocZip, limparCNPJ } = require('./_lib/parser-distnsu');

const ENDPOINTS = {
  // ATENÇÃO: hom.nfe.fazenda.gov.br (sem o "1") foi DESATIVADO em 23/05/2022
  // especificamente para o NFeDistribuicaoDFe — o substituto é hom1.
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};
const CUF_MT = '51';
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
const MAX_DOCS_POR_CHAMADA = 50; // igual ao tamanho máximo de um lote da própria SEFAZ (nunca truncar abaixo disso — ver nota abaixo)

function montarEnvelopeSoap(ambiente, cnpj, ultNsu) {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  // Compacto de propósito — mesma lição do NfeStatusServico (cStat 588).
  const distDFeInt = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${CUF_MT}</cUFAutor><CNPJ>${cnpj}</CNPJ><distNSU><ultNSU>${ultNsu}</ultNSU></distNSU></distDFeInt>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">${distDFeInt}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
}

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

// docZip vem como <docZip NSU="000000000000123" schema="resNFe_v1.01.xsd">BASE64...</docZip>
function extrairDocZips(xml) {
  const regex = /<docZip NSU="(\d+)"(?:\s+schema="([^"]*)")?>([^<]*)<\/docZip>/g;
  const resultados = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    resultados.push({ nsu: m[1], schema: m[2] || '', base64: m[3] });
  }
  return resultados;
}

function descompactarDocZip(base64) {
  const gzipBuffer = Buffer.from(base64, 'base64');
  const xmlBuffer = zlib.gunzipSync(gzipBuffer);
  return xmlBuffer.toString('utf-8');
}

// Vinculação de fornecedor + classificação de material — mesma lógica da
// Etapa 13.3 (client-side), reimplementada aqui pro fluxo automático.
async function vincularFornecedorEClassificar(supabaseAdmin, documentoId, dados) {
  const resultado = { fornecedorCriado: false, itensVinculados: 0, itensPendentes: 0 };
  if (!dados.cnpj_emitente) return resultado;

  let { data: fornecedor } = await supabaseAdmin.from('fornecedores').select('id').eq('cnpj', dados.cnpj_emitente).maybeSingle();

  if (!fornecedor) {
    const end = dados._emitente_endereco || {};
    const { data: novoForn, error: errForn } = await supabaseAdmin.from('fornecedores').insert([{
      razao_social: dados._emitente_nome || dados.cnpj_emitente,
      cnpj: dados.cnpj_emitente,
      logradouro: end.logradouro || null, numero: end.numero || null, bairro: end.bairro || null,
      cidade: end.municipio || null, uf: end.uf || null,
      origem_cadastro: 'pre_cadastro_fiscal', status_pre_cadastro: 'aguardando_confirmacao',
      ativo: true,
    }]).select('id').single();
    if (!errForn) { fornecedor = novoForn; resultado.fornecedorCriado = true; }
  }

  if (fornecedor) {
    await supabaseAdmin.from('fiscal_documentos').update({ fornecedor_id: fornecedor.id }).eq('id', documentoId);

    const { data: itens } = await supabaseAdmin.from('fiscal_documento_itens').select('id, descricao_original').eq('documento_id', documentoId);
    for (const item of (itens || [])) {
      const { data: alias } = await supabaseAdmin.from('fornecedor_item_nomenclatura')
        .select('material_id').eq('fornecedor_id', fornecedor.id).eq('descricao_fornecedor', item.descricao_original).maybeSingle();
      if (alias?.material_id) {
        await supabaseAdmin.from('fiscal_documento_itens').update({
          material_id: alias.material_id, confianca_vinculo: 'alta', status_classificacao: 'vinculado',
        }).eq('id', item.id);
        resultado.itensVinculados++;
      } else {
        resultado.itensPendentes++;
      }
    }
  }
  return resultado;
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

    // ── 1. Estado de sincronização ─────────────────────────────────
    let { data: syncState } = await supabaseAdmin.from('fiscal_sync_state')
      .select('*').eq('tipo_documento', 'NFE').eq('ambiente', ambiente).eq('empresa_id', cert.empresa_id).maybeSingle();

    if (!syncState) {
      const { data: novo, error: errNovo } = await supabaseAdmin.from('fiscal_sync_state').insert([{
        empresa_id: cert.empresa_id, tipo_documento: 'NFE', ambiente,
        ultimo_nsu: '000000000000000', status: 'aguardando',
      }]).select('*').single();
      if (errNovo) { res.status(500).json({ error: 'Falha ao criar estado de sincronização: ' + errNovo.message }); return; }
      syncState = novo;
    }

    // ── 2. Respeita o bloqueio de 1h (rejeição 656) ────────────────
    if (syncState.proxima_tentativa_permitida && new Date(syncState.proxima_tentativa_permitida) > new Date()) {
      res.status(429).json({
        error: 'Aguardando janela de 1h após "consumo indevido" — não é permitido consultar de novo ainda.',
        proxima_tentativa_permitida: syncState.proxima_tentativa_permitida,
      });
      return;
    }

    // ── 3. Monta e envia a requisição ──────────────────────────────
    const cnpj = cert.cnpj_certificado || limparCNPJ(req.body?.cnpj || '');
    const envelope = montarEnvelopeSoap(ambiente, cnpj, syncState.ultimo_nsu);
    const url = ENDPOINTS[ambiente];

    const inicio = Date.now();
    const resposta = await chamarComCertificado(url, envelope, certPem, keyPem, SOAP_ACTION);
    const duracaoMs = Date.now() - inicio;

    const cStat = extrairTag(resposta.body, 'cStat');
    const xMotivo = extrairTag(resposta.body, 'xMotivo');
    const ultNSU = extrairTag(resposta.body, 'ultNSU');
    const maxNSU = extrairTag(resposta.body, 'maxNSU');

    const execucaoId = crypto.randomUUID();
    await supabaseAdmin.from('fiscal_logs').insert([{
      empresa_id: cert.empresa_id, execucao_id: execucaoId, nivel: 'info',
      mensagem: `distNSU (${ambiente}): cStat=${cStat} xMotivo=${xMotivo} ultNSU=${ultNSU} maxNSU=${maxNSU}`,
      metadados: { http_status: resposta.statusCode, duracao_ms: duracaoMs },
    }]);

    // ── 4. Trata cStat=656 (consumo indevido) — NÃO avança NSU ─────
    if (cStat === '656') {
      const proximaTentativa = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from('fiscal_sync_state').update({
        status: 'consumo_indevido', mensagem_erro: xMotivo,
        proxima_tentativa_permitida: proximaTentativa, updated_at: new Date().toISOString(),
      }).eq('id', syncState.id);
      res.status(429).json({ error: xMotivo || 'Consumo indevido — aguarde 1h.', cStat, proxima_tentativa_permitida: proximaTentativa });
      return;
    }

    // ── 5. Qualquer outro erro — não avança NSU, mas registra ──────
    if (cStat !== '137' && cStat !== '138') {
      await supabaseAdmin.from('fiscal_sync_state').update({
        status: 'erro', mensagem_erro: `cStat=${cStat}: ${xMotivo}`, updated_at: new Date().toISOString(),
      }).eq('id', syncState.id);
      await supabaseAdmin.from('fiscal_logs').insert([{
        empresa_id: cert.empresa_id, execucao_id: execucaoId, nivel: 'erro',
        mensagem: `distNSU (${ambiente}) — resposta inesperada, cStat=${cStat}`,
        metadados: { http_status: resposta.statusCode, corpo_bruto: resposta.body.slice(0, 4000) },
      }]);
      res.status(502).json({ error: `SEFAZ retornou cStat=${cStat}: ${xMotivo}`, corpo_bruto: resposta.body.slice(0, 2000) });
      return;
    }

    // ── 6. Processa os documentos retornados (cStat 137 = nenhum, 138 = tem) ──
    // BUG CORRIGIDO (30/08/2026): a SEFAZ manda até 50 docs por lote, e o
    // ultNSU/maxNSU do passo 7 se referem ao LOTE INTEIRO. Truncar o
    // processamento abaixo de 50 e ainda assim avançar o ultimo_nsu pro
    // valor do lote inteiro faria a sincronização PULAR documentos nunca
    // processados — crítico justamente ao importar muito histórico
    // acumulado de uma vez. MAX_DOCS_POR_CHAMADA agora é igual ao teto
    // real de um lote (50), então nunca trunca de verdade.
    const todosDocZips = extrairDocZips(resposta.body);
    const docZips = todosDocZips.slice(0, MAX_DOCS_POR_CHAMADA);
    const resumo = { processados: 0, ignorados_duplicados: 0, eventos: 0, erros: 0, fornecedores_criados: 0, itens_vinculados: 0, itens_pendentes: 0 };

    for (const docZip of docZips) {
      try {
        const xml = descompactarDocZip(docZip.base64);
        const hashXml = crypto.createHash('sha256').update(xml, 'utf-8').digest('hex');
        const { tipo, dados } = parseDocZip(xml, docZip.schema);

        if (tipo === 'documento') {
          const { data: existente } = await supabaseAdmin.from('fiscal_documentos')
            .select('id').or(`hash_xml.eq.${hashXml}${dados.chave_acesso ? ',chave_acesso.eq.' + dados.chave_acesso : ''}`).maybeSingle();
          if (existente) { resumo.ignorados_duplicados++; continue; }

          const { data: novoDoc, error: errDoc } = await supabaseAdmin.from('fiscal_documentos').insert([{
            empresa_id: cert.empresa_id,
            tipo_documento: dados.tipo_documento,
            modelo: dados.modelo || null, serie: dados.serie || null, numero: dados.numero || null,
            chave_acesso: dados.chave_acesso || null,
            data_emissao: dados.data_emissao ? new Date(dados.data_emissao).toISOString() : null,
            cnpj_emitente: dados.cnpj_emitente || null, cnpj_destinatario: dados.cnpj_destinatario || null,
            valor_total: dados.valor_total || 0, ambiente, protocolo: dados.protocolo || null,
            nsu: docZip.nsu,
            status: dados._resumo ? 'pendente' : 'processada', // resumo (resNFe) fica "pendente" pq não tem itens ainda
            hash_xml: hashXml, data_processamento: new Date().toISOString(),
          }]).select('id').single();

          if (errDoc) { resumo.erros++; continue; }

          if (dados.itens && dados.itens.length) {
            await supabaseAdmin.from('fiscal_documento_itens').insert(dados.itens.map(it => ({ ...it, documento_id: novoDoc.id })));
          }

          const vinculo = await vincularFornecedorEClassificar(supabaseAdmin, novoDoc.id, dados);
          if (vinculo.fornecedorCriado) resumo.fornecedores_criados++;
          resumo.itens_vinculados += vinculo.itensVinculados;
          resumo.itens_pendentes += vinculo.itensPendentes;
          resumo.processados++;
        } else if (tipo === 'evento') {
          // Só grava o evento se já existir o documento correspondente
          // (senão fica órfão) — caso raro de evento chegar antes do
          // documento, fica pra uma próxima sincronização reprocessar.
          const { data: docExistente } = await supabaseAdmin.from('fiscal_documentos').select('id').eq('chave_acesso', dados.chave_acesso).maybeSingle();
          if (docExistente) {
            await supabaseAdmin.from('fiscal_eventos').insert([{
              documento_id: docExistente.id, tipo_evento: dados.tipo_evento, sequencia: dados.sequencia,
              data_evento: dados.data_evento ? new Date(dados.data_evento).toISOString() : null,
              protocolo: dados.protocolo, descricao: dados.descricao,
            }]);
            resumo.eventos++;
          }
        }
      } catch (eDoc) {
        resumo.erros++;
        await supabaseAdmin.from('fiscal_logs').insert([{
          empresa_id: cert.empresa_id, execucao_id: execucaoId, nivel: 'erro',
          mensagem: `Falha ao processar docZip NSU=${docZip.nsu}: ${eDoc.message}`, metadados: {},
        }]);
      }
    }

    // ── 7. Atualiza o estado — só avança o NSU depois de processar tudo ──
    // Defesa extra: se por algum motivo viesse mais que MAX_DOCS_POR_CHAMADA
    // (não deveria, a SEFAZ já limita a 50 por lote — ver nota no passo 6),
    // NUNCA avança pro ultNSU do lote inteiro sem ter processado tudo —
    // usa o NSU do último item realmente processado como teto seguro.
    const houveTruncamentoReal = todosDocZips.length > docZips.length;
    const ultNsuSeguro = houveTruncamentoReal
      ? (docZips[docZips.length - 1]?.nsu || syncState.ultimo_nsu)
      : (ultNSU || syncState.ultimo_nsu);
    const consumoIndevidoEmBreve = !houveTruncamentoReal && ultNSU === maxNSU; // não há mais nada novo
    await supabaseAdmin.from('fiscal_sync_state').update({
      ultimo_nsu: ultNsuSeguro,
      maior_nsu: maxNSU,
      ultima_sincronizacao: new Date().toISOString(),
      status: 'ok', mensagem_erro: null,
      // Se não há mais nada novo, já deixamos a janela de 1h marcada de
      // propósito — evita qualquer tentativa de reconsulta imediata que
      // acionaria a rejeição 656 de verdade.
      proxima_tentativa_permitida: consumoIndevidoEmBreve ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', syncState.id);

    res.status(200).json({
      ok: true, cStat, xMotivo, ultNSU, maxNSU, duracao_ms: duracaoMs,
      nada_novo: consumoIndevidoEmBreve,
      docs_recebidos_nesta_chamada: docZips.length,
      ...resumo,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
