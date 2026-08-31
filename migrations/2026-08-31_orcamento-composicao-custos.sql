-- =====================================================================
--  FABASI — ORÇAMENTO POR COMPOSIÇÃO DE CUSTOS (insumo + composição + BDI)
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisito: 2026-08-31_obras-orcamento.sql já executada.
-- =====================================================================
--
-- CONCEITOS (padrão de mercado, tipo SINAPI/SICRO, mas SEM importar a
-- base de referência oficial — isso é uma base própria, cadastrada por
-- vocês, com a mesma lógica):
--
--   INSUMO       → item básico com custo unitário (material, mão de obra
--                  por hora, ou equipamento por hora/dia).
--   COMPOSIÇÃO   → uma "receita" que combina insumos em proporções pra
--                  formar 1 unidade de um serviço (ex.: "1 m² de alvenaria
--                  de vedação" = X tijolos + Y argamassa + Z h de pedreiro).
--   BDI          → Benefícios e Despesas Indiretas — percentual de
--                  markup aplicado sobre o custo direto pra chegar no
--                  valor orçado. Fica na obra (cada obra pode ter um BDI
--                  diferente).
--
-- A tabela orcamento_obra_itens (já criada) ganha duas colunas novas
-- (composicao_id, quantidade) — uma linha do orçamento pode continuar
-- sendo um valor direto (como já funcionava) OU ser calculada a partir
-- de quantidade × custo da composição × (1 + BDI).
-- =====================================================================

create table if not exists insumos_orcamento (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'material',        -- material | mao_obra | equipamento
  material_id uuid references materiais(id),     -- preenchido só quando tipo = 'material' (reaproveita o cadastro)
  descricao text not null,
  unidade text,                                   -- kg, m, m², m³, un, h, dia...
  custo_unitario_referencia numeric(14,4) not null default 0,
  origem text default 'manual',                   -- manual | historico_fornecedor
  data_referencia date default current_date,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_insumos_tipo on insumos_orcamento (tipo);

create table if not exists composicoes_orcamento (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  descricao text not null,
  unidade text not null,                          -- unidade da composição (m², m³, un, vb...)
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists composicao_insumos (
  id uuid primary key default gen_random_uuid(),
  composicao_id uuid references composicoes_orcamento(id) on delete cascade,
  insumo_id uuid references insumos_orcamento(id),
  coeficiente numeric(14,6) not null default 0,    -- quantidade do insumo por 1 unidade da composição
  created_at timestamptz default now()
);

create index if not exists idx_composicao_insumos_composicao on composicao_insumos (composicao_id);

-- Orçamento de obra ganha o vínculo opcional com composição.
alter table orcamento_obra_itens add column if not exists composicao_id uuid references composicoes_orcamento(id);
alter table orcamento_obra_itens add column if not exists quantidade numeric(14,4);

-- BDI fica na obra — cada obra pode negociar um BDI diferente.
alter table obras add column if not exists bdi_percentual numeric(5,2) default 0;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table insumos_orcamento     enable row level security;
alter table composicoes_orcamento enable row level security;
alter table composicao_insumos    enable row level security;

drop policy if exists insumos_orcamento_acesso on insumos_orcamento;
create policy insumos_orcamento_acesso on insumos_orcamento for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists composicoes_orcamento_acesso on composicoes_orcamento;
create policy composicoes_orcamento_acesso on composicoes_orcamento for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists composicao_insumos_acesso on composicao_insumos;
create policy composicao_insumos_acesso on composicao_insumos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- Auditoria geral — mesmo trigger já usado no resto do sistema.
drop trigger if exists trg_auditoria_generica on insumos_orcamento;
create trigger trg_auditoria_generica after insert or update or delete on insumos_orcamento
  for each row execute function fn_auditoria_generica();

drop trigger if exists trg_auditoria_generica on composicoes_orcamento;
create trigger trg_auditoria_generica after insert or update or delete on composicoes_orcamento
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
