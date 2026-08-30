-- =====================================================================
--  FABASI — CONTAS A PAGAR — Etapa 14.2
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Projeto Supabase: mqijbvcnalbfjbhhjjzx
--  Pré-requisitos: 2026-08-29_fiscal_modulo_etapa13-1.sql e
--                  2026-08-29_centro-custo-plano-contas_etapa14-1.sql
--                  já executadas.
-- =====================================================================
--
-- CONTEXTO E DECISÕES DESTA MIGRATION:
--
-- 1) O Fabasi JÁ TEM uma tabela `parcelas_pagamento_oc` (criada com o
--    comentário explícito "base pro Financeiro" em ordem-compra.html) que
--    rastreia parcelas de pagamento por Ordem de Compra. Em vez de duplicar
--    isso, o Contas a Pagar espelha automaticamente `parcelas_pagamento_oc`
--    para dentro do ledger unificado via trigger (uma via: Compras →
--    Financeiro). O formulário de parcelas em ordem-compra.html continua
--    funcionando exatamente como está — nada muda lá.
--
-- 2) Ledger unificado = `contas_pagar` (título) + `contas_pagar_parcelas`
--    (parcelas), cobrindo 3 origens: 'manual', 'ordem_compra' (espelhado)
--    e 'fiscal' (gerado sob demanda a partir de um documento do Fiscal,
--    via função `fn_gerar_conta_pagar_fiscal`, chamável por RPC).
--
-- 3) Pagamento de uma parcela de origem 'ordem_compra': o app grava direto
--    em `contas_pagar_parcelas` (com juros/multa/desconto, que
--    `parcelas_pagamento_oc` não tem) e TAMBÉM atualiza o status em
--    `parcelas_pagamento_oc` (feito na aplicação, não por trigger de volta
--    — evita qualquer risco de ping-pong entre triggers).
--
-- 4) `ordens_compra` ganha `centro_custo_id` (nullable) — o único campo que
--    faltava pra uma Ordem de Compra já nascer com centro de custo, que o
--    espelho then propaga para o `contas_pagar` gerado automaticamente.
--
-- 5) Rateio (`contas_pagar_rateio`) segue o mesmo padrão já usado no Fiscal
--    (`fiscal_documento_rateio_cc`) — usado só quando um título precisa ser
--    dividido entre mais de um centro de custo.
--
-- 6) Aprovação reaproveita o padrão já existente no Fabasi (RM/RC/OC): a
--    checagem "só master/admin aprovam" é feita no cliente via podeAprovar()
--    (app.js), não via RLS — mantendo consistência com o resto do sistema
--    em vez de introduzir um modelo de permissão novo só pro Financeiro.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. ORDENS DE COMPRA — só a coluna que faltava
-- ═══════════════════════════════════════════════════════════════════
alter table ordens_compra add column if not exists centro_custo_id uuid references centros_custo(id);
create index if not exists idx_oc_centro_custo on ordens_compra (centro_custo_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. CONTAS A PAGAR (título) E PARCELAS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  fornecedor_id uuid references fornecedores(id),
  centro_custo_id uuid references centros_custo(id),   -- null quando tem_rateio = true
  plano_conta_id uuid references plano_contas(id),      -- null quando tem_rateio = true
  tem_rateio boolean default false,
  origem text not null default 'manual',                -- manual | ordem_compra | fiscal
  origem_ordem_compra_id uuid references ordens_compra(id),
  origem_fiscal_documento_id uuid references fiscal_documentos(id),
  valor_total numeric(14,2) not null default 0,
  data_emissao date default current_date,
  status text not null default 'pendente_aprovacao',    -- pendente_aprovacao|aprovado|pago_parcial|pago|cancelado
  aprovado_por_nome text,                                -- mesma convenção de RM/RC/OC (seloAprovacao em app.js)
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (origem_ordem_compra_id)   -- 1 conta a pagar por Ordem de Compra
);

create index if not exists idx_contas_pagar_fornecedor    on contas_pagar (fornecedor_id);
create index if not exists idx_contas_pagar_centro_custo  on contas_pagar (centro_custo_id);
create index if not exists idx_contas_pagar_status        on contas_pagar (status);
create index if not exists idx_contas_pagar_origem        on contas_pagar (origem);

create table if not exists contas_pagar_parcelas (
  id uuid primary key default gen_random_uuid(),
  conta_pagar_id uuid references contas_pagar(id) on delete cascade,
  numero_parcela int not null default 1,
  valor numeric(14,2) not null default 0,
  data_vencimento date,
  data_pagamento date,
  valor_pago numeric(14,2),
  juros numeric(14,2) default 0,
  multa numeric(14,2) default 0,
  desconto numeric(14,2) default 0,
  forma_pagamento text,                                  -- pix | boleto | ted | cartao | dinheiro | outro
  status text not null default 'aberta',                 -- aberta | paga | vencida | cancelada
  origem_parcela_oc_id uuid references parcelas_pagamento_oc(id), -- link de volta, só quando origem = ordem_compra
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cp_parcelas_conta       on contas_pagar_parcelas (conta_pagar_id);
create index if not exists idx_cp_parcelas_status      on contas_pagar_parcelas (status);
create index if not exists idx_cp_parcelas_vencimento  on contas_pagar_parcelas (data_vencimento);
create unique index if not exists uq_cp_parcelas_origem_oc on contas_pagar_parcelas (origem_parcela_oc_id) where origem_parcela_oc_id is not null;

create table if not exists contas_pagar_rateio (
  id uuid primary key default gen_random_uuid(),
  conta_pagar_id uuid references contas_pagar(id) on delete cascade,
  centro_custo_id uuid references centros_custo(id),
  plano_conta_id uuid references plano_contas(id),
  valor numeric(14,2),
  percentual numeric(5,2),
  created_at timestamptz default now()
);

create index if not exists idx_cp_rateio_conta on contas_pagar_rateio (conta_pagar_id);
create index if not exists idx_cp_rateio_cc    on contas_pagar_rateio (centro_custo_id);

-- ═══════════════════════════════════════════════════════════════════
-- 3. ESPELHO AUTOMÁTICO: parcelas_pagamento_oc → contas_pagar (+ parcelas)
--    Via única: Compras → Financeiro. Ver nota 1/3 no topo do arquivo.
-- ═══════════════════════════════════════════════════════════════════
create or replace function fn_sync_contas_pagar_de_oc() returns trigger
language plpgsql as $$
declare
  v_conta_pagar_id uuid;
  v_oc record;
  v_status_cp text;
begin
  if TG_OP = 'DELETE' then
    delete from contas_pagar_parcelas where origem_parcela_oc_id = old.id;
    return old;
  end if;

  select * into v_oc from ordens_compra where id = new.ordem_compra_id;

  select id into v_conta_pagar_id from contas_pagar where origem_ordem_compra_id = new.ordem_compra_id;
  if v_conta_pagar_id is null then
    insert into contas_pagar (descricao, fornecedor_id, centro_custo_id, origem, origem_ordem_compra_id, valor_total, data_emissao, status)
    values ('Ordem de Compra ' || coalesce(v_oc.numero, ''), v_oc.fornecedor_id, v_oc.centro_custo_id, 'ordem_compra', new.ordem_compra_id, coalesce(v_oc.valor_total, 0), current_date, 'pendente_aprovacao')
    returning id into v_conta_pagar_id;
  else
    -- mantém fornecedor/centro de custo/valor sincronizados com a OC atual
    update contas_pagar set
      fornecedor_id   = v_oc.fornecedor_id,
      centro_custo_id = coalesce(centro_custo_id, v_oc.centro_custo_id),
      valor_total     = coalesce(v_oc.valor_total, valor_total),
      updated_at      = now()
    where id = v_conta_pagar_id;
  end if;

  v_status_cp := case new.status
    when 'Paga'      then 'paga'
    when 'Atrasada'  then 'vencida'
    when 'Cancelada' then 'cancelada'
    else 'aberta'
  end;

  if TG_OP = 'INSERT' then
    insert into contas_pagar_parcelas (conta_pagar_id, numero_parcela, valor, data_vencimento, status, origem_parcela_oc_id)
    values (v_conta_pagar_id, new.numero_parcela, new.valor, new.data_vencimento, v_status_cp, new.id);
  elsif TG_OP = 'UPDATE' then
    update contas_pagar_parcelas set
      numero_parcela  = new.numero_parcela,
      valor           = new.valor,
      data_vencimento = new.data_vencimento,
      status          = v_status_cp,
      updated_at      = now()
    where origem_parcela_oc_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_contas_pagar_de_oc on parcelas_pagamento_oc;
create trigger trg_sync_contas_pagar_de_oc
  after insert or update or delete on parcelas_pagamento_oc
  for each row execute function fn_sync_contas_pagar_de_oc();

-- ═══════════════════════════════════════════════════════════════════
-- 4. GERAÇÃO SOB DEMANDA A PARTIR DO FISCAL (RPC — chamada de
--    fiscal-documentos.html, botão "Gerar Conta a Pagar")
-- ═══════════════════════════════════════════════════════════════════
create or replace function fn_gerar_conta_pagar_fiscal(p_documento_id uuid) returns uuid
language plpgsql as $$
declare
  v_doc record;
  v_conta_pagar_id uuid;
begin
  select * into v_doc from fiscal_documentos where id = p_documento_id;
  if v_doc is null then
    raise exception 'Documento fiscal % não encontrado', p_documento_id;
  end if;
  if v_doc.gerou_conta_pagar then
    raise exception 'Este documento já gerou uma conta a pagar';
  end if;

  insert into contas_pagar (descricao, fornecedor_id, centro_custo_id, origem, origem_fiscal_documento_id, valor_total, data_emissao, status)
  values (
    (case v_doc.tipo_documento when 'NFE' then 'NF-e ' else 'NFS-e ' end) || coalesce(v_doc.numero, v_doc.chave_acesso, v_doc.nfse_identificador, ''),
    v_doc.fornecedor_id, v_doc.centro_custo_id, 'fiscal', p_documento_id, coalesce(v_doc.valor_total, 0),
    coalesce(v_doc.data_emissao::date, current_date), 'pendente_aprovacao'
  ) returning id into v_conta_pagar_id;

  -- 1 parcela default (vencimento +30 dias) — o usuário pode dividir depois
  -- em contas_pagar_parcelas, na tela de Contas a Pagar.
  insert into contas_pagar_parcelas (conta_pagar_id, numero_parcela, valor, data_vencimento, status)
  values (v_conta_pagar_id, 1, coalesce(v_doc.valor_total, 0), coalesce(v_doc.data_emissao::date, current_date) + 30, 'aberta');

  update fiscal_documentos set gerou_conta_pagar = true, updated_at = now() where id = p_documento_id;

  return v_conta_pagar_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table contas_pagar           enable row level security;
alter table contas_pagar_parcelas  enable row level security;
alter table contas_pagar_rateio    enable row level security;

-- Leitura para todo usuário ativo; escrita também (a checagem "só
-- master/admin aprovam" já é feita no cliente via podeAprovar(), seguindo
-- o mesmo modelo já usado em Requisição/Solicitação/Ordem de Compra —
-- ver nota 6 no topo do arquivo).
drop policy if exists contas_pagar_acesso on contas_pagar;
create policy contas_pagar_acesso on contas_pagar for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists contas_pagar_parcelas_acesso on contas_pagar_parcelas;
create policy contas_pagar_parcelas_acesso on contas_pagar_parcelas for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists contas_pagar_rateio_acesso on contas_pagar_rateio;
create policy contas_pagar_rateio_acesso on contas_pagar_rateio for all using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

-- =====================================================================
-- FIM — Etapa 14.2
-- Teste rápido depois de rodar: abra uma Ordem de Compra existente, salve
-- as parcelas de pagamento (botão já existente lá) e confira em
-- "contas_pagar"/"contas_pagar_parcelas" que o espelho apareceu sozinho.
-- =====================================================================
