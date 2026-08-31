-- =====================================================================
--  FABASI — AUTOMAÇÃO DA SINCRONIZAÇÃO FISCAL (pg_cron) — Etapa 13.8
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: Etapas 13.1, 13.2, 13.4 e 13.7 já executadas/validadas.
-- =====================================================================
--
-- COMO FUNCIONA:
-- O pg_cron roda DENTRO do Postgres — ele não sabe fazer mTLS com a
-- SEFAZ/ADN (isso é o que a Vercel Function já faz, e foi por isso que
-- migramos essa parte pra lá desde a Etapa 13.4). A automação, então, é
-- o Postgres chamando a MESMA Vercel Function por HTTP comum (via
-- extensão pg_net), só que sem usuário logado no navegador — por isso a
-- Etapa 13.8 (parte código) adicionou um segundo caminho de autenticação
-- por segredo compartilhado (X-Cron-Secret) nas functions.
--
--   pg_cron (agenda) → pg_net (chamada HTTP) → Vercel Function → mTLS com SEFAZ/ADN
--
-- PASSO A PASSO ANTES DE RODAR ESTA MIGRATION:
--
-- 1) Gere um segredo aleatório forte (ex.: no terminal, `openssl rand -hex 32`
--    no Git Bash, ou qualquer gerador de senha de 64+ caracteres).
--
-- 2) No Vercel (Settings → Environment Variables do projeto), adicione:
--    Key: CRON_SECRET / Value: o segredo gerado / Type: Secret. Faça um
--    Redeploy depois de adicionar (mesma rotina das outras variáveis).
--
-- 3) Rode isto no SQL Editor, TROCANDO 'COLE_O_SEGREDO_AQUI' pelo MESMO
--    valor exato usado no passo 2 (guardado no Vault, nunca em texto
--    puro numa tabela normal):
--
--      select fiscal_vault_criar_segredo('COLE_O_SEGREDO_AQUI', 'fiscal_cron_secret');
--
--    Anote o uuid que a função devolve — é o "secret_id" que o restante
--    desta migration vai usar pra recuperar o segredo na hora de montar
--    a chamada HTTP (nunca fica em texto puro em lugar nenhum daqui pra
--    frente).
--
-- 4) TROQUE 'COLE_O_SECRET_ID_AQUI' abaixo (2 ocorrências) pelo uuid do
--    passo 3, e 'https://SEU-DOMINIO.vercel.app' pelo domínio real do
--    projeto no Vercel, antes de rodar o resto da migration.
-- =====================================================================

-- Extensões necessárias (no Supabase, normalmente já vêm habilitadas —
-- se der erro de permissão aqui, habilite via Database → Extensions no
-- painel, procurando por "pg_cron" e "pg_net").
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ═══════════════════════════════════════════════════════════════════
-- Job 1 — Sincronização de NF-e (distNSU), a cada 30 minutos.
-- Ambiente 'homologacao' por padrão — DE PROPÓSITO, até você confirmar
-- que quer automatizar contra produção (aí é só trocar 'homologacao'
-- por 'producao' no body e rodar o select cron.schedule(...) de novo —
-- mesmo nome de job atualiza o agendamento existente).
--
-- Rodar a cada 30 min é seguro mesmo sem novidade: a própria Vercel
-- Function já tem a trava de 1h por "consumo indevido" (Etapa 13.4) —
-- se não passou a janela, ela recusa (HTTP 429) sem nem tentar de novo
-- na SEFAZ, então o cron rodando "à toa" não gasta cota nenhuma.
-- ═══════════════════════════════════════════════════════════════════
select cron.schedule(
  'fiscal-sync-nfe-distnsu',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-DOMINIO.vercel.app/api/fiscal-distnsu-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select fiscal_vault_ler_segredo('COLE_O_SECRET_ID_AQUI'::uuid))
    ),
    body := jsonb_build_object('ambiente', 'homologacao'),
    timeout_milliseconds := 45000
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════════
-- Job 2 — Sincronização de NFS-e (ADN), a cada 30 minutos. Mesma lógica
-- de segurança do Job 1 (a Vercel Function já se protege sozinha).
-- ═══════════════════════════════════════════════════════════════════
select cron.schedule(
  'fiscal-sync-nfse-adn',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-DOMINIO.vercel.app/api/fiscal-nfse-adn-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select fiscal_vault_ler_segredo('COLE_O_SECRET_ID_AQUI'::uuid))
    ),
    body := jsonb_build_object('ambiente', 'homologacao'),
    timeout_milliseconds := 45000
  );
  $$
);

-- =====================================================================
-- COMANDOS ÚTEIS (rodar manualmente quando precisar, não fazem parte da
-- migration em si):
--
-- Ver os jobs agendados:
--   select * from cron.job;
--
-- Ver o histórico de execuções (sucesso/erro) de um job:
--   select * from cron.job_run_details where jobname = 'fiscal-sync-nfe-distnsu' order by start_time desc limit 20;
--
-- Ver as respostas HTTP reais que o pg_net recebeu (útil pra depurar):
--   select * from net._http_response order by created desc limit 20;
--
-- Pausar um job sem apagar (ex.: durante alguma manutenção):
--   select cron.unschedule('fiscal-sync-nfe-distnsu');
--   -- reagendar depois rodando o select cron.schedule(...) de novo.
--
-- Mudar de homologação pra produção: edite o 'ambiente' no body de cada
-- job acima e rode o select cron.schedule(...) correspondente de novo
-- (mesmo nome = atualiza, não duplica).
-- =====================================================================
