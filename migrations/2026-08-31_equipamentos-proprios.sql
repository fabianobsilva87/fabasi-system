-- =====================================================================
--  FABASI — EQUIPAMENTOS E FERRAMENTAS PRÓPRIOS — Núcleo 16
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- IMPORTANTE: isto é DIFERENTE da tabela `equipamentos` já existente
-- (que são ativos de CLIENTE sob contrato PMOC/manutenção — AC,
-- bebedouro, climatizador). Aqui é a FROTA PRÓPRIA da Fabasi (máquinas,
-- ferramentas, veículos que a empresa possui e aloca entre obras) — por
-- isso `equipamentos_proprios`, nome deliberadamente diferente para não
-- colidir nem confundir com o módulo de Refrigeração/Manutenção.
-- =====================================================================

create table if not exists equipamentos_proprios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'ferramenta_manual', -- maquina_pesada | ferramenta_eletrica | ferramenta_manual | veiculo | equipamento_seguranca | outro
  patrimonio text,
  marca text,
  modelo text,
  numero_serie text,
  data_aquisicao date,
  valor_aquisicao numeric(14,2),
  status text not null default 'disponivel',            -- disponivel | em_uso | em_manutencao | baixado
  centro_custo_id uuid references centros_custo(id),     -- alocação ATUAL (null = disponível no almoxarifado)
  qrcode_token uuid,                                       -- mesmo padrão já usado em equipamentos (cliente) e materiais
  ativo boolean default true,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_equip_proprios_centro_custo on equipamentos_proprios (centro_custo_id);
create index if not exists idx_equip_proprios_status on equipamentos_proprios (status);

create table if not exists equipamento_alocacoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references equipamentos_proprios(id) on delete cascade,
  centro_custo_id uuid references centros_custo(id),
  data_inicio date default current_date,
  data_fim date,                                          -- null = alocação vigente
  observacoes text,
  created_at timestamptz default now()
);

create index if not exists idx_equip_alocacoes_equip on equipamento_alocacoes (equipamento_id);
create index if not exists idx_equip_alocacoes_vigente on equipamento_alocacoes (equipamento_id) where data_fim is null;

create table if not exists equipamento_manutencoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references equipamentos_proprios(id) on delete cascade,
  tipo text not null default 'preventiva',                -- preventiva | corretiva
  data date default current_date,
  descricao text,
  custo numeric(14,2) default 0,
  fornecedor_id uuid references fornecedores(id),          -- opcional, se terceirizado
  proxima_revisao date,
  created_at timestamptz default now()
);

create index if not exists idx_equip_manut_equip on equipamento_manutencoes (equipamento_id);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table equipamentos_proprios    enable row level security;
alter table equipamento_alocacoes    enable row level security;
alter table equipamento_manutencoes  enable row level security;

drop policy if exists equipamentos_proprios_acesso on equipamentos_proprios;
create policy equipamentos_proprios_acesso on equipamentos_proprios for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists equipamento_alocacoes_acesso on equipamento_alocacoes;
create policy equipamento_alocacoes_acesso on equipamento_alocacoes for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists equipamento_manutencoes_acesso on equipamento_manutencoes;
create policy equipamento_manutencoes_acesso on equipamento_manutencoes for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on equipamentos_proprios;
create trigger trg_auditoria_generica after insert or update or delete on equipamentos_proprios
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- =====================================================================
