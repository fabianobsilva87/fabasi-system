// =====================================================================
//  CONCREDUR — CONFIGURAÇÃO DE AMBIENTE
//  Para trocar de ambiente, altere APENAS a variável ENV abaixo.
//  'homologacao' → banco de testes
//  'producao'    → banco de produção (nweligwbglblbncaegir)
// =====================================================================

const ENV = 'producao'; // ← PRODUÇÃO ATIVA

const SUPABASE_CONFIG = {
  homologacao: {
    url:     'https://mqijbvcnalbfjbhhjjzx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaWpidmNuYWxiZmpiaGhqanp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM5ODcsImV4cCI6MjA5NjA1OTk4N30.2L_zzKs_voAt5SnmcKeYSBiskX46k8SFFdJgTkIGe7Q',
  },
  producao: {
    url:     'https://nweligwbglblbncaegir.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk',
  },
};

const SUPABASE_URL      = SUPABASE_CONFIG[ENV].url;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG[ENV].anonKey;
const IS_HOMOLOGACAO    = (ENV === 'homologacao');
