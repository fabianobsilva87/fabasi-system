-- =====================================================================
--  FABASI — WRAPPERS DO VAULT PARA O MÓDULO FISCAL — Etapa 13.2 (parte SQL)
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisito: 2026-08-29_fiscal_modulo_etapa13-1.sql já executada
--  Pré-requisito: extensão "supabase_vault" ativa (Database → Extensions)
-- =====================================================================
--
-- O schema `vault` do Supabase não é exposto via PostgREST/RPC por padrão
-- (e não deveria ser, dado o que ele guarda). Estas 3 funções são wrappers
-- SECURITY DEFINER estritamente restritos à service_role — só a Edge
-- Function `fiscal-certificate` (que usa a service role key, nunca exposta
-- ao navegador) consegue chamá-las. O anon/authenticated role NÃO recebe
-- GRANT nenhum aqui.
-- =====================================================================

create or replace function fiscal_vault_criar_segredo(p_secret text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select vault.create_secret(p_secret, p_name) into v_id;
  return v_id;
end;
$$;

create or replace function fiscal_vault_atualizar_segredo(p_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform vault.update_secret(p_id, p_secret);
end;
$$;

create or replace function fiscal_vault_ler_segredo(p_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

-- Trava de segurança: ninguém além da service_role executa isso.
revoke all on function fiscal_vault_criar_segredo(text, text)      from public, anon, authenticated;
revoke all on function fiscal_vault_atualizar_segredo(uuid, text)  from public, anon, authenticated;
revoke all on function fiscal_vault_ler_segredo(uuid)              from public, anon, authenticated;
grant execute on function fiscal_vault_criar_segredo(text, text)      to service_role;
grant execute on function fiscal_vault_atualizar_segredo(uuid, text)  to service_role;
grant execute on function fiscal_vault_ler_segredo(uuid)              to service_role;

-- =====================================================================
-- FIM — Etapa 13.2 (parte SQL)
-- Depois de rodar: em SQL Editor, confirme que "select * from pg_proc
-- where proname like 'fiscal_vault%'" retorna as 3 funções, e que
-- "select has_function_privilege('anon', 'fiscal_vault_ler_segredo(uuid)', 'execute')"
-- retorna false (ninguém do lado do navegador pode ler segredo nenhum).
-- =====================================================================
