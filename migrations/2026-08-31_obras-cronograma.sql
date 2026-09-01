-- =====================================================================
--  FABASI — CRONOGRAMA DE OBRA (etapas + Curva S) — Módulo Obras
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: migrations de Orçamento de Obra e Medição de Obra
--                  já executadas.
-- =====================================================================
--
-- ESCOPO DESTA ENTREGA: cronograma sequencial por etapas (com peso % e
-- datas previstas/reais) + Curva S (previsto x realizado acumulado ao
-- longo do tempo), usando o orçamento e as medições já existentes — NÃO
-- é um Gantt com dependências entre tarefas (caminho crítico), nem
-- Kanban. Essas duas ficam para uma entrega futura se fizerem falta —
-- prioridade foi entregar algo real e útil agora em cima do que já
-- existe, em vez de um diagrama de dependências especulativo.
-- =====================================================================

create table if not exists cronograma_obra_etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  ordem int not null default 1,
  nome text not null,
  percentual_peso numeric(5,2) not null default 0,  -- peso desta etapa no cronograma total (soma das etapas ≈ 100%)
  data_inicio_prevista date,
  data_fim_prevista date,
  data_inicio_real date,
  data_fim_real date,
  status text not null default 'nao_iniciada',       -- nao_iniciada | em_andamento | concluida
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cronograma_obra on cronograma_obra_etapas (obra_id);

alter table cronograma_obra_etapas enable row level security;

drop policy if exists cronograma_obra_etapas_acesso on cronograma_obra_etapas;
create policy cronograma_obra_etapas_acesso on cronograma_obra_etapas for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on cronograma_obra_etapas;
create trigger trg_auditoria_generica after insert or update or delete on cronograma_obra_etapas
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
