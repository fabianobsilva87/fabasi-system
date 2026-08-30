-- =====================================================================
--  FABASI — CORREÇÃO DE RLS: DELETE em fiscal_documentos e tabelas filhas
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- Mesma classe de bug da migration "fiscal-rls-fix-insert-teste.sql":
-- as policies de fiscal_documentos/fiscal_documento_itens cobriam SELECT,
-- UPDATE e INSERT, mas não DELETE. Sem isso, o botão "Excluir" numa nota
-- importada manualmente falha — e mesmo que a policy existisse só em
-- fiscal_documentos, o cascade delete pras tabelas filhas (itens, eventos)
-- também precisa de policy própria sob RLS (o ON DELETE CASCADE do
-- Postgres não ignora RLS quando quem executa não é o dono da tabela).
-- =====================================================================

drop policy if exists fiscal_documentos_delete on fiscal_documentos;
create policy fiscal_documentos_delete on fiscal_documentos
  for delete using (fiscal_usuario_ativo());

drop policy if exists fiscal_itens_delete on fiscal_documento_itens;
create policy fiscal_itens_delete on fiscal_documento_itens
  for delete using (fiscal_usuario_ativo());

drop policy if exists fiscal_eventos_delete on fiscal_eventos;
create policy fiscal_eventos_delete on fiscal_eventos
  for delete using (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Correção de RLS
-- =====================================================================
