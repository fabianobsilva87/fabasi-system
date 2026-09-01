-- =====================================================================
--  FABASI — GESTÃO DE TAREFAS / KANBAN — Núcleo 17
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- DECISÃO DE ESCOPO: colunas do Kanban são um STATUS fixo na própria
-- tarefa (a_fazer | em_andamento | em_revisao | concluida), não uma
-- tabela separada de "colunas configuráveis por quadro". Cobre o caso de
-- uso real sem a complexidade de quadros/colunas customizáveis — se no
-- futuro fizer falta múltiplos quadros com colunas próprias, essa
-- tabela pode ser adicionada sem quebrar o que já existe (a `tarefas`
-- ganharia um `quadro_id` opcional).
-- =====================================================================

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  status text not null default 'a_fazer',           -- a_fazer | em_andamento | em_revisao | concluida
  prioridade text not null default 'media',           -- baixa | media | alta | urgente
  responsavel_id uuid references colaboradores(id),
  centro_custo_id uuid references centros_custo(id),  -- vínculo opcional com obra/administrativo
  data_vencimento date,
  data_conclusao date,
  ordem int default 0,                                 -- posição dentro da coluna (drag and drop)
  criado_por_nome text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tarefas_status on tarefas (status);
create index if not exists idx_tarefas_responsavel on tarefas (responsavel_id);
create index if not exists idx_tarefas_centro_custo on tarefas (centro_custo_id);

alter table tarefas enable row level security;

drop policy if exists tarefas_acesso on tarefas;
create policy tarefas_acesso on tarefas for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on tarefas;
create trigger trg_auditoria_generica after insert or update or delete on tarefas
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
