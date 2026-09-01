-- =====================================================================
--  FABASI — CONTRATOS DE OBRA (+ Aditivos) — Módulo Obras
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisito: obras.html (schema mínimo) já existente.
-- =====================================================================

create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text,
  obra_id uuid references obras(id),
  cliente_id uuid references empresas(id),
  objeto text,
  data_assinatura date,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  condicao_pagamento text,                       -- ex.: "60 DFM", "30/60/90 dias"
  valor_total_original numeric(14,2) default 0,
  valor_total_atual numeric(14,2) default 0,      -- original + soma dos aditivos de valor/reajuste
  status text not null default 'vigente',         -- vigente | encerrado | rescindido | suspenso
  arquivo_url text,                                -- PDF do contrato assinado
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contratos_obra on contratos (obra_id);
create index if not exists idx_contratos_cliente on contratos (cliente_id);

create table if not exists contrato_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id) on delete cascade,
  numero_aditivo int not null default 1,
  tipo text not null default 'reajuste',           -- reajuste | prazo | valor | escopo | outro
  data date default current_date,
  valor_alteracao numeric(14,2) default 0,          -- + ou - (soma no valor_total_atual do contrato)
  nova_data_fim_vigencia date,                       -- preenchido só quando tipo = 'prazo'
  descricao text,
  arquivo_url text,                                   -- PDF do aditivo/proposta de reajuste
  created_at timestamptz default now()
);

create index if not exists idx_contrato_aditivos_contrato on contrato_aditivos (contrato_id);

-- Bucket de documentos de contrato (PDFs assinados, aditivos)
insert into storage.buckets (id, name, public)
values ('documentos-contratos', 'documentos-contratos', true)
on conflict (id) do nothing;

alter table contratos         enable row level security;
alter table contrato_aditivos enable row level security;

drop policy if exists contratos_acesso on contratos;
create policy contratos_acesso on contratos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists contrato_aditivos_acesso on contrato_aditivos;
create policy contrato_aditivos_acesso on contrato_aditivos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on contratos;
create trigger trg_auditoria_generica after insert or update or delete on contratos
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
