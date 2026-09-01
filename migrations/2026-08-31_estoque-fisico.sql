-- =====================================================================
--  FABASI — ESTOQUE FÍSICO (entrada/saída/saldo + QR Code) — Módulo Estoque
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- DECISÕES:
--
-- 1) Local de estoque é um conceito NOVO e simples ("almoxarifado"), NÃO
--    a hierarquia de `locais` (Instituição → Bloco → Setor → Sala), que é
--    de facilities/manutenção — semanticamente outra coisa. Cada
--    almoxarifado pode opcionalmente estar vinculado a uma obra (canteiro).
--
-- 2) Saldo é uma VIEW (não tabela materializada) — sempre soma entradas
--    menos saídas em tempo real. Simples e correto; sem risco de saldo
--    desatualizado. Se o volume de movimentos crescer muito no futuro,
--    dá pra evoluir para materializada com refresh — não é necessário
--    agora.
--
-- 3) `materiais.qrcode_token` reaproveita EXATAMENTE o padrão já usado em
--    `equipamentos` (mesmo tipo de campo, mesma função gerarUrlValidacao,
--    mesmo serviço externo de geração de QR) — preparando o terreno para
--    entrada/saída por leitura de QR Code no futuro, sem reinventar nada.
-- =====================================================================

alter table materiais add column if not exists qrcode_token uuid;

create table if not exists almoxarifados (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'almoxarifado_central', -- almoxarifado_central | obra | veiculo | outro
  obra_id uuid references obras(id),                  -- preenchido quando tipo = 'obra' (estoque de canteiro)
  ativo boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_almoxarifados_obra on almoxarifados (obra_id);

create table if not exists estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materiais(id),
  almoxarifado_id uuid references almoxarifados(id),
  tipo text not null,                                 -- entrada | saida | ajuste
  quantidade numeric(14,4) not null,                   -- sempre positiva; o "tipo" que define o sinal no saldo
  data_movimento date default current_date,
  origem text not null default 'manual',               -- manual | ordem_compra | requisicao_material | ajuste
  origem_id uuid,                                        -- sem FK cruzada — pode apontar pra tabelas diferentes conforme "origem"
  observacoes text,
  criado_por_nome text,
  created_at timestamptz default now()
);

create index if not exists idx_estoque_mov_material     on estoque_movimentos (material_id);
create index if not exists idx_estoque_mov_almoxarifado on estoque_movimentos (almoxarifado_id);
create index if not exists idx_estoque_mov_data         on estoque_movimentos (data_movimento);

-- Saldo = soma(entrada) + soma(ajuste com sinal já embutido no lançamento) − soma(saida).
-- "ajuste" é tratado como entrada/saída conforme o usuário decidir na tela
-- (ajuste positivo soma, ajuste negativo — lançado como saída — subtrai).
create or replace view estoque_saldo as
select
  material_id,
  almoxarifado_id,
  sum(case when tipo in ('entrada','ajuste') then quantidade else 0 end)
    - sum(case when tipo = 'saida' then quantidade else 0 end) as saldo
from estoque_movimentos
group by material_id, almoxarifado_id;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table almoxarifados       enable row level security;
alter table estoque_movimentos  enable row level security;

drop policy if exists almoxarifados_acesso on almoxarifados;
create policy almoxarifados_acesso on almoxarifados for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists estoque_movimentos_acesso on estoque_movimentos;
create policy estoque_movimentos_acesso on estoque_movimentos for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop trigger if exists trg_auditoria_generica on estoque_movimentos;
create trigger trg_auditoria_generica after insert or update or delete on estoque_movimentos
  for each row execute function fn_auditoria_generica();

-- =====================================================================
-- FIM
-- Depois de rodar: cadastre ao menos um almoxarifado ("Almoxarifado
-- Central", por exemplo) antes de lançar a primeira movimentação.
-- =====================================================================
