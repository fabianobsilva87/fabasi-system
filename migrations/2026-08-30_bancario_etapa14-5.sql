-- =====================================================================
--  FABASI — BANCÁRIO (contas, extrato, conciliação) — Etapa 14.5
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: Etapas 14.2 (Contas a Pagar) e 14.3 (Contas a Receber)
--                  já executadas.
-- =====================================================================
--
-- DECISÕES DESTA MIGRATION:
--
-- 1) `bancario_movimentos.conciliado_parcela_id` NÃO tem FK de banco —
--    de propósito. Um movimento pode conciliar com uma parcela de
--    `contas_pagar_parcelas` OU `contas_receber_parcelas` (tabelas
--    diferentes), então a integridade referencial fica por conta da
--    aplicação (igual ao padrão já usado em `origem_parcela_oc_id` nas
--    tabelas de Contas a Pagar).
--
-- 2) `hash_movimento` + índice único por conta bancária evita reimportar
--    o mesmo extrato duas vezes sem querer (mesma lógica de dedup já
--    usada no Fiscal via hash_xml).
--
-- 3) A conciliação NUNCA confirma automaticamente — só sugere (com nível
--    de confiança: alta/média/baixa) e o usuário confirma manualmente.
--    Mesmo princípio já usado na classificação de material do Fiscal.
-- =====================================================================

create table if not exists contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  agencia text,
  numero_conta text,
  tipo text not null default 'corrente',           -- corrente | poupanca
  saldo_atual numeric(14,2) default 0,
  data_saldo date default current_date,
  ativo boolean default true,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bancario_movimentos (
  id uuid primary key default gen_random_uuid(),
  conta_bancaria_id uuid references contas_bancarias(id) on delete cascade,
  data_movimento date not null,
  descricao text,
  valor numeric(14,2) not null,                     -- positivo = crédito/entrada, negativo = débito/saída
  documento text,                                    -- identificador do banco (FITID do OFX, ou linha do CSV)
  hash_movimento text,
  origem text not null default 'manual',             -- manual | ofx | csv
  status_conciliacao text not null default 'pendente', -- pendente | conciliado | ignorado
  conciliado_tipo text,                               -- contas_pagar | contas_receber
  conciliado_parcela_id uuid,                          -- sem FK — ver nota 1 no topo
  conciliado_em timestamptz,
  conciliado_por_nome text,
  created_at timestamptz default now()
);

create unique index if not exists uq_bancario_mov_hash on bancario_movimentos (conta_bancaria_id, hash_movimento) where hash_movimento is not null;
create index if not exists idx_bancario_mov_conta   on bancario_movimentos (conta_bancaria_id);
create index if not exists idx_bancario_mov_status  on bancario_movimentos (status_conciliacao);
create index if not exists idx_bancario_mov_data    on bancario_movimentos (data_movimento);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table contas_bancarias     enable row level security;
alter table bancario_movimentos  enable row level security;

drop policy if exists contas_bancarias_acesso on contas_bancarias;
create policy contas_bancarias_acesso on contas_bancarias for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists bancario_movimentos_acesso on bancario_movimentos;
create policy bancario_movimentos_acesso on bancario_movimentos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Etapa 14.5
-- =====================================================================
