-- =====================================================================
--  FABASI — ORÇAMENTO DE OBRA (gerencial) — Módulo Obras
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: Etapas 14.1 (Centro de Custo/Plano de Contas), 14.2
--                  (Contas a Pagar) e a migration de Auditoria Geral
--                  (2026-08-31_auditoria-geral.sql) já executadas.
-- =====================================================================
--
-- DECISÃO: orçamento GERENCIAL por categoria (linhas do Plano de Contas),
-- não composição de custo unitário por insumo (padrão SINAPI/SICRO — isso
-- exigiria importar uma base de milhares de itens de referência, projeto
-- à parte). Cada linha do orçamento é "quanto está previsto gastar em
-- Materiais/Mão de Obra/Subempreiteiros/etc. nesta obra" — comparável
-- direto contra o que já está sendo pago de verdade via Contas a Pagar
-- (que já carrega centro_custo_id + plano_conta_id desde a Etapa 14.2).
-- =====================================================================

create table if not exists orcamento_obra_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  plano_conta_id uuid references plano_contas(id),
  descricao text,                       -- opcional, detalhe além da categoria (ex.: "Cimento e agregados")
  valor_previsto numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orcamento_obra   on orcamento_obra_itens (obra_id);
create index if not exists idx_orcamento_conta  on orcamento_obra_itens (plano_conta_id);

alter table orcamento_obra_itens enable row level security;

drop policy if exists orcamento_obra_itens_acesso on orcamento_obra_itens;
create policy orcamento_obra_itens_acesso on orcamento_obra_itens for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- Auditoria geral (Etapa recente) — reaproveita o mesmo trigger genérico.
drop trigger if exists trg_auditoria_generica on orcamento_obra_itens;
create trigger trg_auditoria_generica after insert or update or delete on orcamento_obra_itens
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
