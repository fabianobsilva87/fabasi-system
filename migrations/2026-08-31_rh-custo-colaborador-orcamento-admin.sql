-- =====================================================================
--  FABASI — RH: CUSTO DE COLABORADOR + ORÇAMENTO ADMINISTRATIVO
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisito: Etapa 14.1 (Centro de Custo/Plano de Contas) já
--                 executada.
-- =====================================================================
--
-- DECISÕES:
--
-- 1) `colaboradores` ganha salário/benefícios/centro de custo PRÓPRIOS —
--    hoje só existe "salário base" no CARGO (funcoes.func_salario), que é
--    uma referência de faixa, não o salário real de cada pessoa. Um
--    colaborador específico pode negociar diferente do "base" do cargo.
--
-- 2) Encargos (INSS patronal, RAT, Sistema S, FGTS, multa rescisória) são
--    PARÂMETROS CONFIGURÁVEIS (rh_parametros_encargos), com um valor
--    padrão de mercado pré-cadastrado — ⚠️ ISSO PRECISA SER VALIDADO
--    PELO CONTADOR da Fabasi antes de virar decisão real. O padrão
--    assume regime CLT fora do Simples Nacional (INSS patronal cheio);
--    se a Fabasi for optante do Simples, o contador provavelmente vai
--    pedir pra zerar/ajustar o INSS patronal (já vem dentro do DAS).
--
-- 3) Orçamento Administrativo é RECORRENTE MENSAL (um valor previsto que
--    vale todo mês até ser editado) — diferente do Orçamento de Obra
--    (que é o total do projeto). Cobre TODAS as categorias de despesa
--    administrativa do Plano de Contas, não só "Pessoal".
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Colaboradores — salário, benefícios, alocação
-- ═══════════════════════════════════════════════════════════════════
alter table colaboradores add column if not exists salario numeric(14,2);
alter table colaboradores add column if not exists vale_transporte numeric(14,2) default 0;
alter table colaboradores add column if not exists vale_refeicao numeric(14,2) default 0;
alter table colaboradores add column if not exists plano_saude numeric(14,2) default 0;
alter table colaboradores add column if not exists outros_beneficios numeric(14,2) default 0;
alter table colaboradores add column if not exists centro_custo_id uuid references centros_custo(id); -- alocação: obra ou administrativo

-- ═══════════════════════════════════════════════════════════════════
-- 2. Parâmetros de encargos (configurável, com padrão de mercado)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists rh_parametros_encargos (
  id uuid primary key default gen_random_uuid(),
  inss_patronal_pct numeric(5,2) not null default 20.00,
  rat_pct numeric(5,2) not null default 2.00,          -- Risco de Acidente de Trabalho (varia 1-3% conforme FAP)
  sistema_s_pct numeric(5,2) not null default 5.80,     -- SESI/SENAI/SEBRAE/INCRA/Salário Educação
  fgts_pct numeric(5,2) not null default 8.00,
  multa_fgts_rescisao_pct numeric(5,2) not null default 40.00,
  observacoes text default '⚠️ Percentuais padrão de mercado (regime CLT fora do Simples Nacional) — validar com o contador da Fabasi antes de usar como base real, principalmente se a empresa for optante do Simples (INSS patronal já vem dentro do DAS nesse caso).',
  data_vigencia date default current_date,
  created_at timestamptz default now()
);

insert into rh_parametros_encargos (inss_patronal_pct, rat_pct, sistema_s_pct, fgts_pct, multa_fgts_rescisao_pct)
select 20.00, 2.00, 5.80, 8.00, 40.00
where not exists (select 1 from rh_parametros_encargos);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Orçamento Administrativo (recorrente mensal, todas as categorias)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists orcamento_administrativo_itens (
  id uuid primary key default gen_random_uuid(),
  centro_custo_id uuid references centros_custo(id),  -- normalmente um centro administrativo
  plano_conta_id uuid references plano_contas(id),
  descricao text,
  valor_previsto_mensal numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orc_adm_centro_custo on orcamento_administrativo_itens (centro_custo_id);
create index if not exists idx_orc_adm_plano_conta   on orcamento_administrativo_itens (plano_conta_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table rh_parametros_encargos         enable row level security;
alter table orcamento_administrativo_itens enable row level security;

drop policy if exists rh_parametros_encargos_leitura on rh_parametros_encargos;
create policy rh_parametros_encargos_leitura on rh_parametros_encargos for select using (fiscal_usuario_ativo());
drop policy if exists rh_parametros_encargos_escrita on rh_parametros_encargos;
create policy rh_parametros_encargos_escrita on rh_parametros_encargos for all using (fiscal_is_admin()) with check (fiscal_is_admin());

drop policy if exists orcamento_administrativo_itens_acesso on orcamento_administrativo_itens;
create policy orcamento_administrativo_itens_acesso on orcamento_administrativo_itens for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- Auditoria geral
drop trigger if exists trg_auditoria_generica on orcamento_administrativo_itens;
create trigger trg_auditoria_generica after insert or update or delete on orcamento_administrativo_itens
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
