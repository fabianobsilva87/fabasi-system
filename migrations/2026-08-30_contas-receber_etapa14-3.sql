-- =====================================================================
--  FABASI — CONTAS A RECEBER — Etapa 14.3
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: 2026-08-29_fiscal_modulo_etapa13-1.sql e
--                  2026-08-29_centro-custo-plano-contas_etapa14-1.sql
--                  já executadas.
-- =====================================================================
--
-- DECISÕES DESTA MIGRATION:
--
-- 1) Diferente do Contas a Pagar (que já nasceu com espelho automático de
--    parcelas_pagamento_oc), NÃO existe hoje nenhum lugar do sistema
--    gerando receita de verdade — nem obras-medicao.html nem os.html têm
--    campo de valor ainda (ambos são só operacionais). Por isso o Contas
--    a Receber nasce só com lançamento MANUAL. `origem_obra_id` e
--    `origem_os_id` já existem na tabela (sem FK travando ainda pra
--    `os`, cujo schema real não foi conferido) para quando Medição de
--    Obra e faturamento de O.S. forem construídos de verdade.
--
-- 2) SEM fluxo de aprovação (diferente do Contas a Pagar) — é uma
--    simplificação deliberada: dinheiro entrando tem menos necessidade
--    de um gate de aprovação do que dinheiro saindo. Status vai direto
--    de 'pendente' para 'recebido_parcial'/'recebido'.
-- =====================================================================

create table if not exists contas_receber (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  cliente_id uuid references empresas(id),            -- empresas.tipo = 'contratante'
  centro_custo_id uuid references centros_custo(id),   -- null quando tem_rateio = true
  plano_conta_id uuid references plano_contas(id),     -- null quando tem_rateio = true
  tem_rateio boolean default false,
  origem text not null default 'manual',                -- manual | obra | os (os/obra reservados p/ automação futura)
  origem_obra_id uuid references obras(id),
  origem_os_id uuid,                                     -- sem FK ainda — schema de os.html não confirmado
  valor_total numeric(14,2) not null default 0,
  data_emissao date default current_date,
  status text not null default 'pendente',              -- pendente | recebido_parcial | recebido | cancelado
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contas_receber_cliente       on contas_receber (cliente_id);
create index if not exists idx_contas_receber_centro_custo  on contas_receber (centro_custo_id);
create index if not exists idx_contas_receber_status        on contas_receber (status);

create table if not exists contas_receber_parcelas (
  id uuid primary key default gen_random_uuid(),
  conta_receber_id uuid references contas_receber(id) on delete cascade,
  numero_parcela int not null default 1,
  valor numeric(14,2) not null default 0,
  data_vencimento date,
  data_recebimento date,
  valor_recebido numeric(14,2),
  juros numeric(14,2) default 0,
  multa numeric(14,2) default 0,
  desconto numeric(14,2) default 0,
  forma_recebimento text,                                -- pix | boleto | ted | cartao | dinheiro | outro
  status text not null default 'aberta',                 -- aberta | recebida | vencida | cancelada
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cr_parcelas_conta       on contas_receber_parcelas (conta_receber_id);
create index if not exists idx_cr_parcelas_status      on contas_receber_parcelas (status);
create index if not exists idx_cr_parcelas_vencimento  on contas_receber_parcelas (data_vencimento);

create table if not exists contas_receber_rateio (
  id uuid primary key default gen_random_uuid(),
  conta_receber_id uuid references contas_receber(id) on delete cascade,
  centro_custo_id uuid references centros_custo(id),
  plano_conta_id uuid references plano_contas(id),
  valor numeric(14,2),
  percentual numeric(5,2),
  created_at timestamptz default now()
);

create index if not exists idx_cr_rateio_conta on contas_receber_rateio (conta_receber_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table contas_receber           enable row level security;
alter table contas_receber_parcelas  enable row level security;
alter table contas_receber_rateio    enable row level security;

drop policy if exists contas_receber_acesso on contas_receber;
create policy contas_receber_acesso on contas_receber for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists contas_receber_parcelas_acesso on contas_receber_parcelas;
create policy contas_receber_parcelas_acesso on contas_receber_parcelas for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists contas_receber_rateio_acesso on contas_receber_rateio;
create policy contas_receber_rateio_acesso on contas_receber_rateio for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Etapa 14.3
-- =====================================================================
