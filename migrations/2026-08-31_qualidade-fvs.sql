-- =====================================================================
--  FABASI — QUALIDADE / FICHAS DE VERIFICAÇÃO DE SERVIÇO (FVS) — Núcleo 18
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- CONCEITO: FVS é um checklist de qualidade aplicado antes de considerar
-- uma etapa de serviço como concluída (ex.: "Verificação de Concretagem",
-- "Verificação de Alvenaria"). Modelo é reutilizável entre obras; cada
-- preenchimento copia a descrição do item no momento (não referencia
-- só o modelo) para não quebrar o histórico se o modelo for editado
-- depois — mesmo cuidado já tomado em outras partes do sistema.
--
-- Não-conformidade não tem tabela própria — é só um item preenchido com
-- resultado = 'nao_conforme'; a Central de Não Conformidades é uma
-- consulta filtrada em cima de fvs_itens_preenchidos, sem duplicar dado.
-- =====================================================================

create table if not exists fvs_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists fvs_modelo_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references fvs_modelos(id) on delete cascade,
  ordem int not null default 1,
  descricao text not null
);

create index if not exists idx_fvs_modelo_itens_modelo on fvs_modelo_itens (modelo_id);

create table if not exists fvs_preenchidas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references fvs_modelos(id),
  obra_id uuid references obras(id),
  numero int not null default 1,                    -- sequencial por obra
  data_inspecao date default current_date,
  inspetor_nome text,
  status text not null default 'pendente',           -- pendente | aprovada | reprovada (calculado ao salvar)
  observacoes_gerais text,
  fotos_urls jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_fvs_preenchidas_obra on fvs_preenchidas (obra_id);
create index if not exists idx_fvs_preenchidas_status on fvs_preenchidas (status);

create table if not exists fvs_itens_preenchidos (
  id uuid primary key default gen_random_uuid(),
  fvs_id uuid references fvs_preenchidas(id) on delete cascade,
  descricao text not null,                            -- copiada do modelo no momento do preenchimento
  resultado text not null default 'conforme',          -- conforme | nao_conforme | nao_aplicavel
  observacao text
);

create index if not exists idx_fvs_itens_fvs on fvs_itens_preenchidos (fvs_id);
create index if not exists idx_fvs_itens_resultado on fvs_itens_preenchidos (resultado);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table fvs_modelos            enable row level security;
alter table fvs_modelo_itens       enable row level security;
alter table fvs_preenchidas        enable row level security;
alter table fvs_itens_preenchidos  enable row level security;

drop policy if exists fvs_modelos_acesso on fvs_modelos;
create policy fvs_modelos_acesso on fvs_modelos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists fvs_modelo_itens_acesso on fvs_modelo_itens;
create policy fvs_modelo_itens_acesso on fvs_modelo_itens for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists fvs_preenchidas_acesso on fvs_preenchidas;
create policy fvs_preenchidas_acesso on fvs_preenchidas for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists fvs_itens_preenchidos_acesso on fvs_itens_preenchidos;
create policy fvs_itens_preenchidos_acesso on fvs_itens_preenchidos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on fvs_preenchidas;
create trigger trg_auditoria_generica after insert or update or delete on fvs_preenchidas
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
