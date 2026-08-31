-- =====================================================================
--  FABASI — REGISTRO FOTOGRÁFICO NA MEDIÇÃO DE OBRA
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisito: 2026-08-31_obras-medicao.sql já executada.
-- =====================================================================

alter table medicoes_obra add column if not exists fotos_urls jsonb default '[]'::jsonb;

-- =====================================================================
-- FIM
-- =====================================================================
