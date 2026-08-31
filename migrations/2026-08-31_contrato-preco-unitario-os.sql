-- =====================================================================
--  FABASI — CONTRATO POR PREÇO UNITÁRIO: TABELA DE PREÇOS + OS DE OBRA
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Pré-requisitos: migrations de Orçamento de Obra, Medição de Obra e
--                  Fiscal (13.1) já executadas.
-- =====================================================================
--
-- CONTEXTO: além do padrão já construído (composição de custo + %
-- avanço acumulado), existe um segundo padrão de contrato — comum com
-- clientes grandes (ex.: saneamento) — onde o cliente já fornece uma
-- TABELA DE PREÇOS própria daquele contrato (itens de material, mão de
-- obra por diária/hora, locação, serviço — cada um com custo unitário e
-- BDI). Cada intervenção executada vira uma ORDEM DE SERVIÇO DE OBRA
-- (tabela separada da OS de Manutenção/Refrigeração, a pedido), puxando
-- preços dessa tabela, com material vinculado à nota fiscal real de
-- compra, mão de obra, locação, e registro fotográfico antes/depois.
--
-- Depois de várias OS executadas, o usuário ESCOLHE MANUALMENTE quais
-- entram numa Medição — reaproveita a mesma tabela medicoes_obra e o
-- mesmo fluxo de aprovação → Gerar Conta a Receber já construído, só com
-- uma origem diferente (soma de OS's, não % de avanço por categoria).
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. Marca informativa do tipo de contrato na obra (não é uma trava —
--    as duas abordagens podem coexistir se precisar).
-- ═══════════════════════════════════════════════════════════════════
alter table obras add column if not exists tipo_contrato text default 'composicao'; -- composicao | preco_unitario

-- ═══════════════════════════════════════════════════════════════════
-- 2. Tabela de Preços do Contrato (por obra — não é genérica como
--    Insumos/Composições, é a planilha negociada com aquele cliente)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists tabela_precos_contrato (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  item_numero int,
  descricao text not null,
  tipo text not null default 'material',        -- material | mao_obra | locacao | servico
  unidade text,                                   -- DIÁRIA, HORA, M², M, VB, PC...
  quantidade_contratada numeric(14,4),            -- referência do total contratado (informativo)
  custo_unitario_sem_bdi numeric(14,4) not null default 0,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tabela_precos_obra on tabela_precos_contrato (obra_id);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Ordens de Serviço de Obra (tabela separada da OS de Manutenção)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists ordens_servico_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  numero_os int not null default 1,               -- sequencial por obra
  descricao_servico text not null,
  data_execucao date default current_date,
  status text not null default 'aberta',          -- aberta | concluida | sincronizada
  valor_total numeric(14,2) default 0,             -- soma dos itens (com BDI)
  observacoes text,
  fotos_urls jsonb default '[]'::jsonb,            -- [{url, tipo: 'antes'|'depois'}] — mesmo formato já usado no resto do sistema
  medicao_id uuid references medicoes_obra(id),    -- preenchido quando sincronizada pra uma medição
  criado_por_nome text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_os_obra_obra   on ordens_servico_obra (obra_id);
create index if not exists idx_os_obra_status on ordens_servico_obra (status);
create index if not exists idx_os_obra_medicao on ordens_servico_obra (medicao_id);

create table if not exists os_obra_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid references ordens_servico_obra(id) on delete cascade,
  tipo text not null default 'material',          -- material | mao_obra | locacao | servico
  tabela_preco_item_id uuid references tabela_precos_contrato(id), -- opcional, quando veio da tabela de preços
  fiscal_documento_id uuid references fiscal_documentos(id),        -- opcional — só faz sentido pra tipo='material'
  descricao text not null,
  quantidade numeric(14,4) not null default 0,
  custo_unitario_sem_bdi numeric(14,4) not null default 0,
  custo_unitario_com_bdi numeric(14,4) not null default 0,
  valor_total numeric(14,2) not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_os_obra_itens_os on os_obra_itens (os_id);
create index if not exists idx_os_obra_itens_fiscal on os_obra_itens (fiscal_documento_id);

-- ═══════════════════════════════════════════════════════════════════
-- 4. Medição ganha uma "origem" — soma de OS's é uma forma alternativa
--    de chegar no valor da medição, além do % de avanço por categoria.
-- ═══════════════════════════════════════════════════════════════════
alter table medicoes_obra add column if not exists origem text default 'avanco_fisico'; -- avanco_fisico | ordens_servico

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table tabela_precos_contrato enable row level security;
alter table ordens_servico_obra    enable row level security;
alter table os_obra_itens          enable row level security;

drop policy if exists tabela_precos_contrato_acesso on tabela_precos_contrato;
create policy tabela_precos_contrato_acesso on tabela_precos_contrato for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists ordens_servico_obra_acesso on ordens_servico_obra;
create policy ordens_servico_obra_acesso on ordens_servico_obra for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists os_obra_itens_acesso on os_obra_itens;
create policy os_obra_itens_acesso on os_obra_itens for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- Auditoria geral
drop trigger if exists trg_auditoria_generica on ordens_servico_obra;
create trigger trg_auditoria_generica after insert or update or delete on ordens_servico_obra
  for each row execute function fn_auditoria_generica();

drop trigger if exists trg_auditoria_generica on tabela_precos_contrato;
create trigger trg_auditoria_generica after insert or update or delete on tabela_precos_contrato
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
