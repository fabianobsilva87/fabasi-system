-- =====================================================================
--  FABASI — CENTROS DE CUSTO + PLANO DE CONTAS — Etapa 14.1
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Projeto Supabase: mqijbvcnalbfjbhhjjzx
--  Pré-requisito: 2026-08-29_fiscal_modulo_etapa13-1.sql já executada
-- =====================================================================
--
-- CONTEXTO E DECISÕES DESTA MIGRATION:
--
-- 1) "1 obra = 1 centro de custo automático" (decidido com o Fabiano) exige
--    uma tabela `obras` de verdade — hoje obras.html é só um placeholder de
--    58 linhas, sem schema. Por isso esta migration cria uma tabela `obras`
--    MÍNIMA (nome, cliente, endereço, responsável, status, prazos, valor de
--    contrato) — o suficiente pra sustentar o centro de custo e a Requisição
--    de Materiais/Fiscal já poderem referenciar uma obra real. Orçamento,
--    Cronograma, Medição e Contratos continuam como módulos futuros que vão
--    CONSTRUIR EM CIMA desta mesma tabela `obras`, não substituí-la.
--
-- 2) Centro de custo administrativo é cadastrado à mão; centro de custo de
--    obra é gerado automaticamente por trigger no INSERT em `obras` (e o
--    nome é mantido sincronizado se a obra for renomeada).
--
-- 3) Rateio já entra nesta etapa (decidido com o Fabiano). Em vez de criar
--    `fiscal_documento_rateio_obra` como o documento original do Fiscal
--    previa (Etapa 13.9, adiada por falta de tabela `obras`), criamos
--    `fiscal_documento_rateio_cc` usando CENTRO DE CUSTO — que já cobre
--    obra 1:1 via `centros_custo.obra_id`, então um único mecanismo de
--    rateio serve tanto pra ratear entre obras quanto entre centros
--    administrativos (ex.: aluguel do escritório dividido entre Diretoria
--    e Comercial). A coluna solta `fiscal_documentos.obra_id` (sem FK,
--    nunca usada — a tabela está vazia) é removida e substituída por
--    `centro_custo_id`, com FK de verdade.
--
-- 4) Plano de contas é GERENCIAL (para enxergar margem por obra/categoria),
--    não o plano contábil fiscal do contador — esse continua fora do
--    Fabasi, na contabilidade externa.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. OBRAS (schema mínimo — ver nota 1 acima)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid references empresas(id),          -- empresas.tipo = 'contratante'
  endereco text,
  cidade text,
  uf text,
  responsavel_id uuid references colaboradores(id),
  status text not null default 'planejamento',       -- planejamento|mobilizacao|em_execucao|pausada|concluida|encerrada
  data_inicio date,
  data_prevista_termino date,
  data_encerramento date,
  valor_contrato numeric(14,2),
  observacoes text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_obras_cliente on obras (cliente_id);
create index if not exists idx_obras_status  on obras (status);

-- ═══════════════════════════════════════════════════════════════════
-- 2. CENTROS DE CUSTO
-- ═══════════════════════════════════════════════════════════════════
create table if not exists centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  tipo text not null check (tipo in ('administrativo','obra')),
  obra_id uuid unique references obras(id),          -- preenchido só quando tipo = 'obra'
  descricao text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chk_centro_custo_tipo_obra check (
    (tipo = 'obra'          and obra_id is not null) or
    (tipo = 'administrativo' and obra_id is null)
  )
);

create index if not exists idx_centros_custo_tipo on centros_custo (tipo);
create index if not exists idx_centros_custo_obra on centros_custo (obra_id);

-- Geração automática do centro de custo ao cadastrar uma obra. Segue a
-- mesma convenção de código curto já usada no Fabasi (ver rotuloOS() em
-- app.js, que usa os 5 primeiros caracteres do uuid).
create or replace function fn_criar_centro_custo_obra() returns trigger
language plpgsql as $$
begin
  insert into centros_custo (codigo, nome, tipo, obra_id)
  values ('CC-OBRA-' || upper(substr(new.id::text, 1, 6)), new.nome, 'obra', new.id);
  return new;
end;
$$;

drop trigger if exists trg_obras_criar_centro_custo on obras;
create trigger trg_obras_criar_centro_custo
  after insert on obras
  for each row execute function fn_criar_centro_custo_obra();

-- Mantém o nome do centro de custo sincronizado se a obra for renomeada.
create or replace function fn_sync_nome_centro_custo_obra() returns trigger
language plpgsql as $$
begin
  if new.nome is distinct from old.nome then
    update centros_custo set nome = new.nome, updated_at = now() where obra_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_obras_sync_nome_centro_custo on obras;
create trigger trg_obras_sync_nome_centro_custo
  after update on obras
  for each row execute function fn_sync_nome_centro_custo_obra();

-- ═══════════════════════════════════════════════════════════════════
-- 3. PLANO DE CONTAS (gerencial, hierárquico — grupo → conta analítica)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists plano_contas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  tipo text not null check (tipo in ('receita','custo','despesa')),
  conta_pai_id uuid references plano_contas(id),
  nivel int not null default 1,
  -- Sugestão de UI (não é regra rígida — pode haver exceção via rateio):
  -- indica se essa conta normalmente é lançada em centro de custo de obra,
  -- administrativo, ou os dois.
  centro_custo_tipo_sugerido text check (centro_custo_tipo_sugerido in ('administrativo','obra')),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_plano_contas_pai on plano_contas (conta_pai_id);
create index if not exists idx_plano_contas_tipo on plano_contas (tipo);

-- ── Seed — estrutura gerencial enxuta proposta para a Fabasi ──────────
-- (2 níveis: grupo e conta analítica; fácil de estender depois)
do $$
declare
  g_receitas uuid; g_custos uuid; g_despesas uuid; g_impostos uuid;
begin
  insert into plano_contas (codigo, nome, tipo, nivel) values
    ('1', 'RECEITAS', 'receita', 1) returning id into g_receitas;
  insert into plano_contas (codigo, nome, tipo, nivel) values
    ('2', 'CUSTOS DIRETOS DE OBRA', 'custo', 1) returning id into g_custos;
  insert into plano_contas (codigo, nome, tipo, nivel) values
    ('3', 'DESPESAS ADMINISTRATIVAS', 'despesa', 1) returning id into g_despesas;
  insert into plano_contas (codigo, nome, tipo, nivel) values
    ('4', 'IMPOSTOS E TRIBUTOS', 'despesa', 1) returning id into g_impostos;

  insert into plano_contas (codigo, nome, tipo, nivel, conta_pai_id, centro_custo_tipo_sugerido) values
    ('1.01', 'Receita de Obras (Medições e Faturamento)', 'receita', 2, g_receitas, 'obra'),
    ('1.02', 'Receita de Serviços de Manutenção (O.S.)',  'receita', 2, g_receitas, 'administrativo'),
    ('1.03', 'Outras Receitas',                            'receita', 2, g_receitas, null),

    ('2.01', 'Materiais de Construção',                'custo', 2, g_custos, 'obra'),
    ('2.02', 'Mão de Obra Direta',                      'custo', 2, g_custos, 'obra'),
    ('2.03', 'Subempreiteiros e Terceirizados',         'custo', 2, g_custos, 'obra'),
    ('2.04', 'Locação de Equipamentos',                 'custo', 2, g_custos, 'obra'),
    ('2.05', 'Frete e Transporte de Obra',               'custo', 2, g_custos, 'obra'),
    ('2.06', 'EPI e Segurança do Trabalho',              'custo', 2, g_custos, 'obra'),
    ('2.07', 'Taxas, Licenças e ART de Obra',            'custo', 2, g_custos, 'obra'),

    ('3.01', 'Pessoal Administrativo',                              'despesa', 2, g_despesas, 'administrativo'),
    ('3.02', 'Ocupação (Aluguel, Condomínio, Utilidades)',          'despesa', 2, g_despesas, 'administrativo'),
    ('3.03', 'Frota Administrativa',                                'despesa', 2, g_despesas, 'administrativo'),
    ('3.04', 'Tecnologia e Sistemas',                               'despesa', 2, g_despesas, 'administrativo'),
    ('3.05', 'Marketing e Comercial',                               'despesa', 2, g_despesas, 'administrativo'),
    ('3.06', 'Serviços Profissionais (Contábil, Jurídico)',         'despesa', 2, g_despesas, 'administrativo'),
    ('3.07', 'Despesas Financeiras e Bancárias',                    'despesa', 2, g_despesas, 'administrativo'),
    ('3.08', 'Depreciação e Manutenção de Ativos Administrativos',  'despesa', 2, g_despesas, 'administrativo'),

    ('4.01', 'Impostos sobre Faturamento (ISS, PIS, COFINS, Simples)', 'despesa', 2, g_impostos, null),
    ('4.02', 'Outras Taxas e Tributos',                                 'despesa', 2, g_impostos, null)
  on conflict (codigo) do nothing;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. RATEIO POR CENTRO DE CUSTO — aplicado ao Fiscal desde já
-- ═══════════════════════════════════════════════════════════════════
alter table fiscal_documentos drop column if exists obra_id;   -- nunca usada (tabela vazia, sem FK) — ver nota 3
alter table fiscal_documentos add column if not exists centro_custo_id uuid references centros_custo(id);
create index if not exists idx_fiscal_doc_centro_custo on fiscal_documentos (centro_custo_id);

create table if not exists fiscal_documento_rateio_cc (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references fiscal_documentos(id) on delete cascade,
  centro_custo_id uuid references centros_custo(id),
  plano_conta_id uuid references plano_contas(id),
  valor numeric(14,2),
  percentual numeric(5,2),
  created_at timestamptz default now()
);

create index if not exists idx_fiscal_rateio_documento on fiscal_documento_rateio_cc (documento_id);
create index if not exists idx_fiscal_rateio_cc on fiscal_documento_rateio_cc (centro_custo_id);

-- ═══════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table obras                       enable row level security;
alter table centros_custo               enable row level security;
alter table plano_contas                enable row level security;
alter table fiscal_documento_rateio_cc  enable row level security;

-- Obras: leitura para qualquer usuário ativo; cadastro/edição reservados a
-- admin/master por enquanto (o módulo Obras ainda não tem papéis próprios
-- definidos — ajustar quando obras.html virar o módulo completo).
drop policy if exists obras_leitura on obras;
create policy obras_leitura on obras for select using (fiscal_usuario_ativo());
drop policy if exists obras_escrita on obras;
create policy obras_escrita on obras for all using (fiscal_is_admin()) with check (fiscal_is_admin());

-- Centro de custo e plano de contas são estrutura financeira: leitura para
-- todo usuário ativo (precisam aparecer em selects de formulários), escrita
-- só para admin/master.
drop policy if exists centros_custo_leitura on centros_custo;
create policy centros_custo_leitura on centros_custo for select using (fiscal_usuario_ativo());
drop policy if exists centros_custo_escrita on centros_custo;
create policy centros_custo_escrita on centros_custo for all using (fiscal_is_admin()) with check (fiscal_is_admin());

drop policy if exists plano_contas_leitura on plano_contas;
create policy plano_contas_leitura on plano_contas for select using (fiscal_usuario_ativo());
drop policy if exists plano_contas_escrita on plano_contas;
create policy plano_contas_escrita on plano_contas for all using (fiscal_is_admin()) with check (fiscal_is_admin());

drop policy if exists fiscal_rateio_cc_leitura on fiscal_documento_rateio_cc;
create policy fiscal_rateio_cc_leitura on fiscal_documento_rateio_cc for select using (fiscal_usuario_ativo());
drop policy if exists fiscal_rateio_cc_escrita on fiscal_documento_rateio_cc;
create policy fiscal_rateio_cc_escrita on fiscal_documento_rateio_cc for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Etapa 14.1
-- Depois de rodar: conferir "Database → Tables" (obras, centros_custo,
-- plano_contas, fiscal_documento_rateio_cc), que fiscal_documentos ganhou
-- centro_custo_id (e perdeu obra_id), e que plano_contas já veio com as
-- 19 contas gerenciais da seed. Teste rápido: cadastre uma obra de teste
-- em obras.html e confira em centros_custo que o centro CC-OBRA-XXXXXX
-- apareceu sozinho.
-- =====================================================================
