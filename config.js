// =====================================================================
//  FABASI — CONFIGURAÇÃO DE AMBIENTE
// =====================================================================
//  Preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo com as credenciais
//  do projeto Supabase NOVO e VAZIO, criado exclusivamente para a
//  Fabasi (Project Settings → API, no painel do Supabase).
//
//  Os dois projetos usados anteriormente por este sistema (o rotulado
//  "homologação" e o de produção do Concredur/Univag) tinham dado real
//  daquele contrato misturado e NÃO devem ser reaproveitados aqui.
//  Nenhum outro arquivo do projeto referencia um ID de banco — é seguro
//  trocar só os dois valores abaixo.
// =====================================================================

const SUPABASE_URL      = 'https://mqijbvcnalbfjbhhjjzx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaWpidmNuYWxiZmpiaGhqanp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM5ODcsImV4cCI6MjA5NjA1OTk4N30.2L_zzKs_voAt5SnmcKeYSBiskX46k8SFFdJgTkIGe7Q';

// Mantido por compatibilidade: trechos do app.js e de programacao-pmoc.html
// checam "typeof IS_HOMOLOGACAO === 'undefined' || !IS_HOMOLOGACAO" para
// decidir se exibem a faixa de aviso "AMBIENTE DE HOMOLOGAÇÃO". Como agora
// há um único ambiente, essa faixa fica permanentemente desligada.
const IS_HOMOLOGACAO    = false;
