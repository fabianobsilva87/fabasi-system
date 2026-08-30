-- =====================================================================
--  FABASI — FLUXO DE CAIXA (saldo manual) — Etapa 14.4
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: Etapas 14.2 (Contas a Pagar) e 14.3 (Contas a Receber)
--                  já executadas.
-- =====================================================================
--
-- Sem módulo Bancário real ainda (contas correntes, extrato, saldo
-- automático), o "saldo atual" do Fluxo de Caixa precisa ser informado
-- manualmente — um checkpoint que o usuário atualiza sempre que confere o
-- saldo real no banco. A projeção a partir daí é 100% calculada em cima
-- de contas_pagar_parcelas e contas_receber_parcelas (nenhuma tabela nova
-- de movimentação — é só leitura do que já existe).
-- =====================================================================

create table if not exists fluxo_caixa_saldo (
  id uuid primary key default gen_random_uuid(),
  saldo numeric(14,2) not null,
  data_referencia date not null default current_date,
  observacoes text,
  created_at timestamptz default now()
);

create index if not exists idx_fluxo_caixa_saldo_data on fluxo_caixa_saldo (data_referencia desc);

alter table fluxo_caixa_saldo enable row level security;

drop policy if exists fluxo_caixa_saldo_acesso on fluxo_caixa_saldo;
create policy fluxo_caixa_saldo_acesso on fluxo_caixa_saldo for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Etapa 14.4
-- =====================================================================
