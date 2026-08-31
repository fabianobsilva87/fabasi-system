-- =====================================================================
--  FABASI — MEDIÇÃO DE OBRA (por item do orçamento) — Módulo Obras
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: migrations de Orçamento de Obra e Composição de Custos
--                  já executadas.
-- =====================================================================
--
-- CONCEITO: cada medição registra o AVANÇO FÍSICO ACUMULADO (%) de cada
-- linha do orçamento (orcamento_obra_itens). O valor faturável desta
-- medição = (percentual acumulado agora − percentual acumulado na
-- medição anterior) × valor previsto daquela linha. É o padrão usual de
-- medição por avanço físico na construção civil.
--
-- Ao aprovar uma medição, um botão gera automaticamente uma Conta a
-- Receber (mesmo padrão já usado em OC → Contas a Pagar) — fecha o
-- ciclo Obras → Financeiro.
-- =====================================================================

create table if not exists medicoes_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  numero_medicao int not null default 1,
  periodo_inicio date,
  periodo_fim date,
  status text not null default 'rascunho',        -- rascunho | aprovada | faturada
  data_medicao date default current_date,
  valor_total_medicao numeric(14,2) default 0,     -- soma dos itens (calculado ao salvar)
  origem_conta_receber_id uuid references contas_receber(id),
  aprovado_por_nome text,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_medicoes_obra on medicoes_obra (obra_id);
create index if not exists idx_medicoes_status on medicoes_obra (status);

create table if not exists medicao_itens (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid references medicoes_obra(id) on delete cascade,
  orcamento_item_id uuid references orcamento_obra_itens(id),
  percentual_acumulado numeric(5,2) not null default 0,   -- % acumulado até esta medição (0-100)
  valor_acumulado numeric(14,2) not null default 0,        -- percentual_acumulado × valor_previsto do item
  valor_desta_medicao numeric(14,2) not null default 0,    -- valor_acumulado − valor_acumulado da medição anterior
  observacoes text
);

create index if not exists idx_medicao_itens_medicao   on medicao_itens (medicao_id);
create index if not exists idx_medicao_itens_orcamento on medicao_itens (orcamento_item_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table medicoes_obra enable row level security;
alter table medicao_itens enable row level security;

drop policy if exists medicoes_obra_acesso on medicoes_obra;
create policy medicoes_obra_acesso on medicoes_obra for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists medicao_itens_acesso on medicao_itens;
create policy medicao_itens_acesso on medicao_itens for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- Auditoria geral
drop trigger if exists trg_auditoria_generica on medicoes_obra;
create trigger trg_auditoria_generica after insert or update or delete on medicoes_obra
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
