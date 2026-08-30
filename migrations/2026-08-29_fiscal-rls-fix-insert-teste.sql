-- =====================================================================
--  FABASI — CORREÇÃO DE RLS: INSERT em fiscal_documentos/itens
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- BUG na migration 2026-08-29_fiscal_modulo_etapa13-1.sql: as policies de
-- fiscal_documentos e fiscal_documento_itens cobriam SELECT e UPDATE, mas
-- não INSERT. Fazia sentido no desenho original (documento entraria só via
-- Edge Function com service role, que ignora RLS) — mas a Etapa 13.3
-- (upload de XML de teste) ficou 100% client-side, então o navegador
-- (usuário autenticado, sujeito a RLS) precisa conseguir inserir.
--
-- Sem policy de INSERT, o Postgres nega por padrão com RLS habilitado —
-- foi exatamente o erro "new row violates row-level security policy for
-- table fiscal_documentos" reportado no teste real.
-- =====================================================================

drop policy if exists fiscal_documentos_insert on fiscal_documentos;
create policy fiscal_documentos_insert on fiscal_documentos
  for insert with check (fiscal_usuario_ativo());

drop policy if exists fiscal_itens_insert on fiscal_documento_itens;
create policy fiscal_itens_insert on fiscal_documento_itens
  for insert with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Correção de RLS
-- Depois de rodar: repita o upload do XML de teste em fiscal-documentos.html.
-- =====================================================================
