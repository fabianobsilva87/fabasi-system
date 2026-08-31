-- =====================================================================
--  FABASI — REQUISIÇÃO DE MATERIAL ⇄ OBRA (vínculo opcional)
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- requisicoes_material hoje só vincula a uma O.S. (contexto de
-- Manutenção/Refrigeração). Para o botão "Disparar Compra" a partir de
-- um item do Orçamento de Obra, precisa também poder vincular a uma
-- Obra diretamente — os dois vínculos são independentes (uma requisição
-- pode ter OS, obra, ou nenhum dos dois).
-- =====================================================================

alter table requisicoes_material add column if not exists obra_id uuid references obras(id);
create index if not exists idx_requisicoes_material_obra on requisicoes_material (obra_id);

-- =====================================================================
-- FIM
-- =====================================================================
