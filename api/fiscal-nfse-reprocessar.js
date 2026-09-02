// =====================================================================
//  FABASI — /api/fiscal-nfse-reprocessar (correção pontual, uso único)
// =====================================================================
//
// TENTATIVA 1 (abandonada): reconstruir a partir do lote_bruto salvo em
// fiscal_logs — não deu, porque o log foi salvo com `.slice(0, 8000)` e
// um lote de 30 itens (cada um com XML grande) estoura isso de longe —
// o JSON fica cortado no meio, impossível de recuperar dali.
//
// ESTRATÉGIA REAL: apaga os documentos NFS-e quebrados (sem CNPJ — sinal
// de que vieram da versão antiga do parser) e RETROCEDE o ponteiro de
// posição (ultimo_nsu) da sincronização de NFS-e, pra próxima chamada à
// ADN buscar essas mesmas notas de novo — só que com o parser já
// corrigido. NÃO faz a chamada à ADN aqui — só prepara o terreno; depois
// é só clicar em "Sincronizar NFS-e (ADN)" de novo.
// =====================================================================

const { createClient } = require('@supabase/supabase-js');
const { autenticarEAutorizar } = require('./_lib/certificado');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  try {
    const auth = await autenticarEAutorizar(req, createClient);
    if (auth.erro) { res.status(auth.erro.status).json(auth.erro.body); return; }
    const { supabaseAdmin } = auth;

    const ambiente = (req.body?.ambiente === 'producao') ? 'producao' : 'homologacao';

    // Remove os documentos NFS-e "quebrados" (sem CNPJ — só a versão
    // antiga do parser gera isso; os corretos sempre têm cnpj_emitente).
    const { data: apagados, error: errDelete } = await supabaseAdmin
      .from('fiscal_documentos')
      .delete()
      .eq('tipo_documento', 'NFSE')
      .is('cnpj_emitente', null)
      .select('id');

    if (errDelete) { res.status(500).json({ error: 'Erro ao apagar documentos quebrados: ' + errDelete.message }); return; }

    // Retrocede o ponteiro de posição pra '0' — a próxima sincronização
    // busca tudo de novo desde o início (retenção do ADN parece ser bem
    // mais longa que os 90 dias da NF-e, então isso é seguro).
    const { error: errReset } = await supabaseAdmin
      .from('fiscal_sync_state')
      .update({ ultimo_nsu: '0', status: 'aguardando', proxima_tentativa_permitida: null, updated_at: new Date().toISOString() })
      .eq('tipo_documento', 'NFSE')
      .eq('ambiente', ambiente);

    if (errReset) { res.status(500).json({ error: 'Documentos quebrados apagados, mas erro ao resetar a posição: ' + errReset.message }); return; }

    res.status(200).json({
      ok: true, apagados: (apagados || []).length,
      aviso: 'Pronto — clique em "Sincronizar NFS-e (ADN)" agora pra buscar essas notas de novo, já com o parser corrigido.',
    });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
};
