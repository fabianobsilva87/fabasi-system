// =====================================================================
//  FABASI — /api/fiscal-nfse-adn-sync  (Etapa 13.7: sincronização NFS-e)
// =====================================================================
//
// ✅ CONFIRMADO EM TESTE REAL (30/08/2026, homologação/Produção Restrita):
//   GET https://adn.producaorestrita.nfse.gov.br/contribuintes/DFe/0
//   → HTTP 404 (!) com corpo JSON:
//     {
//       "StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO",
//       "LoteDFe": [],
//       "Alertas": [],
//       "Erros": [{ "Codigo": "E2220", "Descricao": "Nenhum documento..." }],
//       "TipoAmbiente": "HOMOLOGACAO",
//       "VersaoAplicativo": "1.0.0.0",
//       "DataHoraProcessamento": "..."
//     }
//   Ou seja: a API usa HTTP 404 como forma (estranha, mas real) de dizer
//   "chamada válida, sem documentos" — não é erro de conexão nem de auth.
//   mTLS + caminho /DFe/{ultimoNSU} estão confirmados corretos.
//
// ⚠️ AINDA NÃO CONFIRMADO: o formato de um item dentro de `LoteDFe` quando
// EXISTE documento (só vi a lista vazia até agora). O parsing abaixo é
// uma tentativa razoável baseada no padrão já visto (campos PascalCase,
// documento provavelmente em GZip+Base64 como no distNSU da NF-e) — mas
// precisa ser confirmado no primeiro lote real. Por isso: loga o LoteDFe
// bruto em fiscal_logs SEMPRE que não estiver vazio, antes/além de tentar
// parsear — se o parsing falhar, o dado bruto não se perde.
// =====================================================================

const zlib = require('zlib');
const crypto = require('crypto');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar, obterCertificadoAtivo } = require('./_lib/certificado');
const { limparCNPJ } = require('./_lib/parser-distnsu');

const BASES = {
  homologacao: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
  producao: 'https://adn.nfse.gov.br/contribuintes',
};
const CODIGO_SEM_DOCUMENTOS = 'E2220';
const MAX_DOCS_POR_CHAMADA = 30; // mesma proteção contra timeout usada no distNSU

function chamarAdn(url, certPem, keyPem) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ cert: certPem, key: keyPem, rejectUnauthorized: false });
    const { hostname, pathname, search } = new URL(url);
    const req = https.request({
      hostname, path: pathname + search, method: 'GET', agent,
      headers: { 'Accept': 'application/json' }, timeout: 20000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao conectar com o ADN.')));
    req.on('error', reject);
    req.end();
  });
}

// Tentativa de extrair o XML de um item de LoteDFe — campos possíveis
// (ainda não confirmados): ArquivoXml / Xml / ConteudoXml, geralmente
// GZip+Base64 (padrão já usado no distNSU da NF-e).
function extrairXmlDoItem(item) {
  const candidatos = ['ArquivoXml', 'Xml', 'ConteudoXml', 'DocumentoXml'];
  for (const campo of candidatos) {
    if (item[campo]) {
      try {
        return zlib.gunzipSync(Buffer.from(item[campo], 'base64')).toString('utf-8');
      } catch (_e) {
        // pode não estar gzipado — tenta como base64 puro
        try { return Buffer.from(item[campo], 'base64').toString('utf-8'); }
        catch (_e2) { return null; }
      }
    }
  }
  return null;
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

    let { data: syncState } = await supabaseAdmin.from('fiscal_sync_state')
      .select('*').eq('tipo_documento', 'NFSE').eq('ambiente', ambiente).eq('empresa_id', cert.empresa_id).maybeSingle();

    if (!syncState) {
      const { data: novo, error: errNovo } = await supabaseAdmin.from('fiscal_sync_state').insert([{
        empresa_id: cert.empresa_id, tipo_documento: 'NFSE', ambiente,
        ultimo_nsu: '0', status: 'aguardando',
      }]).select('*').single();
      if (errNovo) { res.status(500).json({ error: 'Falha ao criar estado de sincronização: ' + errNovo.message }); return; }
      syncState = novo;
    }

    if (syncState.proxima_tentativa_permitida && new Date(syncState.proxima_tentativa_permitida) > new Date()) {
      res.status(429).json({ error: 'Aguardando janela antes de nova consulta.', proxima_tentativa_permitida: syncState.proxima_tentativa_permitida });
      return;
    }

    const url = `${BASES[ambiente]}/DFe/${syncState.ultimo_nsu || '0'}`;
    const inicio = Date.now();
    const resposta = await chamarAdn(url, certPem, keyPem);
    const duracaoMs = Date.now() - inicio;

    let corpo;
    try { corpo = JSON.parse(resposta.body); }
    catch (_e) {
      res.status(502).json({ error: 'Resposta do ADN não veio em JSON.', http_status: resposta.statusCode, corpo_bruto: resposta.body.slice(0, 2000) });
      return;
    }

    const execucaoId = crypto.randomUUID();
    await supabaseAdmin.from('fiscal_logs').insert([{
      empresa_id: cert.empresa_id, execucao_id: execucaoId, nivel: 'info',
      mensagem: `NFS-e ADN (${ambiente}): HTTP ${resposta.statusCode} — StatusProcessamento=${corpo.StatusProcessamento}`,
      metadados: { url, http_status: resposta.statusCode, duracao_ms: duracaoMs, corpo_bruto: resposta.body.slice(0, 4000) },
    }]);

    const semDocumentos = corpo.StatusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO'
      || (corpo.Erros || []).some(e => e.Codigo === CODIGO_SEM_DOCUMENTOS);

    // Erro de verdade: HTTP de erro E não é o caso "sem documentos" conhecido.
    if (resposta.statusCode >= 400 && !semDocumentos) {
      await supabaseAdmin.from('fiscal_sync_state').update({
        status: 'erro', mensagem_erro: JSON.stringify(corpo.Erros || corpo), updated_at: new Date().toISOString(),
      }).eq('id', syncState.id);
      res.status(502).json({ error: 'ADN retornou erro.', http_status: resposta.statusCode, corpo_bruto: resposta.body.slice(0, 2000) });
      return;
    }

    const loteDFe = (corpo.LoteDFe || []).slice(0, MAX_DOCS_POR_CHAMADA);
    const resumo = { processados: 0, erros: 0, fornecedores_criados: 0 };

    if (loteDFe.length) {
      // Ainda não confirmado em produção — loga o lote bruto sempre que
      // não vier vazio, pra nunca perder o dado mesmo se o parsing abaixo
      // errar o campo.
      await supabaseAdmin.from('fiscal_logs').insert([{
        empresa_id: cert.empresa_id, execucao_id: execucaoId, nivel: 'info',
        mensagem: `NFS-e ADN: LoteDFe com ${loteDFe.length} item(ns) — formato ainda não confirmado, gravando bruto.`,
        metadados: { lote_bruto: JSON.stringify(loteDFe).slice(0, 8000) },
      }]);

      for (const item of loteDFe) {
        try {
          const xml = extrairXmlDoItem(item);
          const chaveAcesso = item.ChaveAcesso || item.Chave || null;
          const cnpjPrestador = limparCNPJ(item.CnpjPrestador || item.Prestador?.Cnpj || '');
          const valor = Number(item.ValorServico || item.ValorTotal || 0);
          const hashXml = xml ? crypto.createHash('sha256').update(xml, 'utf-8').digest('hex') : crypto.randomUUID();

          const { data: existente } = await supabaseAdmin.from('fiscal_documentos')
            .select('id').or(`hash_xml.eq.${hashXml}${chaveAcesso ? ',nfse_identificador.eq.' + chaveAcesso : ''}`).maybeSingle();
          if (existente) continue;

          const { data: novoDoc, error: errDoc } = await supabaseAdmin.from('fiscal_documentos').insert([{
            empresa_id: cert.empresa_id, tipo_documento: 'NFSE',
            nfse_identificador: chaveAcesso, cnpj_emitente: cnpjPrestador || null,
            valor_total: valor, ambiente, status: 'pendente', // pendente = precisa de conferência manual (layout não 100% confirmado)
            nsu: item.NSU || null, data_processamento: new Date().toISOString(),
            hash_xml: hashXml,
          }]).select('id').single();

          if (errDoc) { resumo.erros++; continue; }
          resumo.processados++;

          if (cnpjPrestador) {
            const { data: fornExistente } = await supabaseAdmin.from('fornecedores').select('id').eq('cnpj', cnpjPrestador).maybeSingle();
            if (!fornExistente) {
              const { error: errForn } = await supabaseAdmin.from('fornecedores').insert([{
                razao_social: item.RazaoSocialPrestador || item.Prestador?.RazaoSocial || cnpjPrestador,
                cnpj: cnpjPrestador, origem_cadastro: 'pre_cadastro_fiscal',
                status_pre_cadastro: 'aguardando_confirmacao', ativo: true,
              }]);
              if (!errForn) resumo.fornecedores_criados++;
            }
          }
        } catch (eItem) {
          resumo.erros++;
        }
      }
    }

    await supabaseAdmin.from('fiscal_sync_state').update({
      ultima_sincronizacao: new Date().toISOString(), status: 'ok', mensagem_erro: null,
      proxima_tentativa_permitida: semDocumentos ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', syncState.id);

    res.status(200).json({
      ok: true, sem_documentos: semDocumentos, docs_no_lote: loteDFe.length,
      duracao_ms: duracaoMs, ...resumo,
      aviso: loteDFe.length ? 'Formato do LoteDFe ainda não confirmado — confira fiscal_logs (lote_bruto) e os documentos criados (status=pendente) antes de confiar nos dados.' : null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
