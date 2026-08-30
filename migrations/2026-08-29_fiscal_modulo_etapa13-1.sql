-- =====================================================================
--  FABASI — MÓDULO FISCAL — Etapa 13.1
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
--  Projeto Supabase: mqijbvcnalbfjbhhjjzx
-- =====================================================================
--
-- AJUSTES EM RELAÇÃO AO DOCUMENTO DE ARQUITETURA (Fase 2 original):
--
-- 1) O documento de arquitetura assumia um modelo multi-empresa com uma
--    tabela `empresas` fazendo o papel de tenant e RLS particionado por
--    `empresa_id`. Isso NÃO existe no Fabasi real: `empresas` já é usada
--    para clientes/contratantes (clientes.html, cotacao.html,
--    ordem-compra.html) e a "empresa" que emite/recebe os documentos
--    fiscais é a Fabasi em si, representada pela linha única de
--    `empresa_master`. Por isso, abaixo `empresa_id` referencia
--    `empresa_master(id)` — é informativo (qual CNPJ da Fabasi gerou o
--    documento, útil se um dia houver mais de uma empresa master), e a
--    segurança de acesso passa a ser por PERFIL (profiles.role/status),
--    não por partição de tenant.
--
-- 2) `material_aliases` do documento original foi eliminada: o Fabasi já
--    tem exatamente essa função na tabela `fornecedor_item_nomenclatura`
--    (aba "Nomenclatura por Fornecedor" em compras.html). Em vez de criar
--    uma tabela paralela, este módulo ESTENDE essa tabela com as colunas
--    que faltavam (origem, confianca) e o parser de XML (Fase 6/8, etapa
--    futura) vai ler/gravar diretamente nela.
--
-- 3) `obras` e a tabela de Contas a Pagar do Financeiro ainda são só
--    páginas-placeholder no Fabasi (obras.html e
--    financeiro-contas-pagar.html, 58 linhas cada, sem schema real).
--    Por isso `obra_id` em fiscal_documentos e a futura
--    fiscal_documento_rateio_obra ainda NÃO recebem FK de verdade nesta
--    migration — ficam como uuid solto, com o FK entrando numa migration
--    posterior (Etapa 13.9), quando o módulo Obras tiver tabela própria.
--    fiscal_documento_rateio_obra também fica de fora desta etapa por
--    esse motivo (a Etapa 13.9 do plano já previa essa dependência).
--
-- Convenções seguidas: nomes de coluna em português, created_at/updated_at
-- em inglês (padrão Supabase), execução manual, nada de DROP destrutivo.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════
-- 1. CERTIFICADO DIGITAL
-- ═══════════════════════════════════════════════════════════════════
create table if not exists fiscal_certificados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresa_master(id),
  cnpj_certificado text,                     -- extraído do certificado, nunca digitado
  arquivo_storage_path text,                 -- Storage privado (bucket fiscal-certificados), NUNCA público
  senha_secret_id text,                      -- referência ao Supabase Vault — a senha em si NUNCA fica aqui
  data_inicio_validade date,
  data_expiracao date,
  status text default 'nao_testado',         -- valido | expirado | invalido | nao_testado
  ambiente_padrao text default 'homologacao',-- producao | homologacao
  data_ultimo_teste timestamptz,
  observacoes text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fiscal_certificado_auditoria (
  id uuid primary key default gen_random_uuid(),
  certificado_id uuid references fiscal_certificados(id) on delete cascade,
  usuario_id uuid references auth.users(id),
  acao text not null,                        -- cadastrado | substituido | removido | testado | sincronizacao_iniciada
  detalhe jsonb,
  ip text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. SINCRONIZAÇÃO / CONTROLE DE NSU (NF-e)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists fiscal_sync_state (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresa_master(id),
  tipo_documento text not null,              -- NFE | EVENTO_NFE
  ambiente text not null default 'homologacao', -- producao | homologacao
  ultimo_nsu text default '000000000000000', -- 15 dígitos, mantido como texto
  maior_nsu text,
  ultima_sincronizacao timestamptz,
  status text default 'aguardando',          -- ok | erro | consumo_indevido | aguardando
  mensagem_erro text,
  proxima_tentativa_permitida timestamptz,   -- respeita o bloqueio de 1h da rejeição 656
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, tipo_documento, ambiente)
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. DOCUMENTOS FISCAIS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists fiscal_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresa_master(id),
  tipo_documento text not null,              -- NFE | NFSE | EVENTO_NFE | OUTRO_DFE
  modelo text,
  serie text,
  numero text,
  chave_acesso text,                         -- 44 posições, quando NFE
  nfse_identificador text,                   -- identificador do ADN, quando NFSE
  data_emissao timestamptz,
  data_entrada timestamptz,
  cnpj_emitente text,
  cnpj_destinatario text,
  valor_total numeric(14,2),
  ambiente text default 'homologacao',       -- producao | homologacao
  status text default 'recebida',            -- recebida|importada|processada|validada|pendente|erro|cancelada|denegada|inutilizada|ignorada
  xml_storage_path text,                     -- Storage privado (bucket fiscal-xml), NUNCA URL pública
  hash_xml text,                             -- SHA-256
  nsu text,
  protocolo text,
  fornecedor_id uuid references fornecedores(id),   -- null até vincular (Fase 7)
  obra_id uuid,                              -- sem FK ainda — ver nota no topo do arquivo (Etapa 13.9)
  gerou_conta_pagar boolean default false,   -- gancho para o Financeiro (tabela ainda não existe)
  data_importacao timestamptz default now(),
  data_processamento timestamptz,
  erro_processamento text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (empresa_id, chave_acesso),
  unique (empresa_id, hash_xml)
);

create table if not exists fiscal_documento_itens (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references fiscal_documentos(id) on delete cascade,
  numero_item int,
  codigo_produto text,
  descricao_original text,                   -- NUNCA editar — é o dado fiscal, imutável
  ncm text,
  cest text,
  cfop text,
  unidade text,
  quantidade numeric(14,4),
  valor_unitario numeric(14,4),
  valor_total numeric(14,2),
  desconto numeric(14,2),
  frete numeric(14,2),
  outras_despesas numeric(14,2),
  origem text,
  cst text,
  csosn text,
  icms jsonb,
  ipi jsonb,
  pis jsonb,
  cofins jsonb,
  material_id uuid references materiais(id),      -- null até classificar (Fase 8)
  confianca_vinculo text,                    -- alta | media | baixa | manual
  status_classificacao text default 'pendente', -- pendente | vinculado | ignorado
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fiscal_eventos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references fiscal_documentos(id) on delete cascade,
  tipo_evento text not null,                 -- cancelamento|carta_correcao|ciencia|confirmacao|desconhecimento|op_nao_realizada|outro
  sequencia int,
  data_evento timestamptz,
  protocolo text,
  descricao text,
  xml_storage_path text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. FILA DE PROCESSAMENTO E LOGS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists fiscal_processing_queue (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references fiscal_documentos(id) on delete cascade,
  etapa text not null,                       -- parser | vinculacao_fornecedor | classificacao_material | estoque | financeiro
  status text default 'pendente',            -- pendente | processando | concluido | erro
  tentativas int default 0,
  erro text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists fiscal_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresa_master(id),
  execucao_id uuid,                          -- agrupa uma rodada de sincronização
  nivel text default 'info',                 -- info | aviso | erro
  mensagem text,
  metadados jsonb,                           -- NUNCA senha/token aqui — allowlist de chaves na função utilitária
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. HISTÓRICO DE PREÇOS (alimentado pelo Fiscal, além do que já existe
--    em historico_precos_fornecedor via Ordem de Compra)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists fiscal_historico_precos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materiais(id),
  fornecedor_id uuid references fornecedores(id),
  documento_item_id uuid references fiscal_documento_itens(id) on delete cascade,
  valor_unitario numeric(14,4),
  data_documento date,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. EXTENSÕES EM TABELAS JÁ EXISTENTES (fornecedores, nomenclatura)
-- ═══════════════════════════════════════════════════════════════════
alter table fornecedores add column if not exists origem_cadastro text default 'manual';       -- manual | pre_cadastro_fiscal
alter table fornecedores add column if not exists status_pre_cadastro text;                     -- null | aguardando_confirmacao

-- Reaproveita fornecedor_item_nomenclatura como o "de-para" também para o
-- Fiscal (ver nota 2 no topo do arquivo) — nada de tabela nova.
alter table fornecedor_item_nomenclatura add column if not exists origem text default 'manual'; -- manual | fiscal
alter table fornecedor_item_nomenclatura add column if not exists confianca text;                -- alta | media | baixa (null em vínculos manuais antigos)

-- ═══════════════════════════════════════════════════════════════════
-- 7. ÍNDICES
-- ═══════════════════════════════════════════════════════════════════
create index if not exists idx_fiscal_doc_cnpj_emitente   on fiscal_documentos (cnpj_emitente);
create index if not exists idx_fiscal_doc_chave_acesso    on fiscal_documentos (chave_acesso);
create index if not exists idx_fiscal_doc_nsu             on fiscal_documentos (nsu);
create index if not exists idx_fiscal_doc_data_emissao    on fiscal_documentos (data_emissao);
create index if not exists idx_fiscal_doc_fornecedor      on fiscal_documentos (fornecedor_id);
create index if not exists idx_fiscal_doc_empresa         on fiscal_documentos (empresa_id);
create index if not exists idx_fiscal_doc_status          on fiscal_documentos (status);
create index if not exists idx_fiscal_itens_documento     on fiscal_documento_itens (documento_id);
create index if not exists idx_fiscal_itens_material      on fiscal_documento_itens (material_id);
create index if not exists idx_fiscal_itens_status_class  on fiscal_documento_itens (status_classificacao);
create index if not exists idx_fiscal_eventos_documento   on fiscal_eventos (documento_id);
create index if not exists idx_fiscal_fila_documento      on fiscal_processing_queue (documento_id);
create index if not exists idx_fiscal_fila_status         on fiscal_processing_queue (status);
create index if not exists idx_fiscal_logs_empresa        on fiscal_logs (empresa_id);
create index if not exists idx_fiscal_logs_execucao       on fiscal_logs (execucao_id);
create index if not exists idx_fiscal_hist_precos_material on fiscal_historico_precos (material_id);
create index if not exists idx_fiscal_hist_precos_forn    on fiscal_historico_precos (fornecedor_id);

-- ═══════════════════════════════════════════════════════════════════
-- 8. FUNÇÕES DE APOIO PARA AS POLICIES (baseadas em profiles.role/status,
--    já usado no resto do Fabasi — ver podeAprovar() em app.js)
-- ═══════════════════════════════════════════════════════════════════
create or replace function fiscal_is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('master','admin') and p.status = 'ativo'
  );
$$;

create or replace function fiscal_usuario_ativo() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.status = 'ativo'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════
alter table fiscal_certificados            enable row level security;
alter table fiscal_certificado_auditoria   enable row level security;
alter table fiscal_sync_state              enable row level security;
alter table fiscal_documentos              enable row level security;
alter table fiscal_documento_itens         enable row level security;
alter table fiscal_eventos                 enable row level security;
alter table fiscal_processing_queue        enable row level security;
alter table fiscal_logs                    enable row level security;
alter table fiscal_historico_precos        enable row level security;

-- Certificado: só master/admin enxergam e mexem diretamente na tabela.
-- O cadastro/teste/remoção de verdade acontece via Edge Function com a
-- service role (Fase 4/13.2) — estas policies cobrem o acesso direto que
-- fiscal-config.html eventualmente fizer para exibir status.
drop policy if exists fiscal_certificados_admin on fiscal_certificados;
create policy fiscal_certificados_admin on fiscal_certificados
  for all using (fiscal_is_admin()) with check (fiscal_is_admin());

drop policy if exists fiscal_certificado_auditoria_admin on fiscal_certificado_auditoria;
create policy fiscal_certificado_auditoria_admin on fiscal_certificado_auditoria
  for select using (fiscal_is_admin());

-- Sincronização: leitura para qualquer usuário ativo (tela de config
-- mostra "última sincronização" para todos); escrita reservada à service
-- role da Edge Function (sem policy de insert/update para authenticated).
drop policy if exists fiscal_sync_state_leitura on fiscal_sync_state;
create policy fiscal_sync_state_leitura on fiscal_sync_state
  for select using (fiscal_usuario_ativo());

-- Documentos, itens, eventos, histórico de preços: leitura para qualquer
-- usuário ativo; classificação manual (update) também liberada para
-- usuário ativo — é exatamente a tela de Conferência Fiscal. Inserção e
-- exclusão ficam para a service role (parser/sync), exceto quando o
-- próprio usuário sobe um XML avulso de teste (Etapa 13.3), que também
-- passa por Edge Function.
drop policy if exists fiscal_documentos_leitura on fiscal_documentos;
create policy fiscal_documentos_leitura on fiscal_documentos
  for select using (fiscal_usuario_ativo());
drop policy if exists fiscal_documentos_update on fiscal_documentos;
create policy fiscal_documentos_update on fiscal_documentos
  for update using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists fiscal_itens_leitura on fiscal_documento_itens;
create policy fiscal_itens_leitura on fiscal_documento_itens
  for select using (fiscal_usuario_ativo());
drop policy if exists fiscal_itens_update on fiscal_documento_itens;
create policy fiscal_itens_update on fiscal_documento_itens
  for update using (fiscal_usuario_ativo()) with check (fiscal_usuario_ativo());

drop policy if exists fiscal_eventos_leitura on fiscal_eventos;
create policy fiscal_eventos_leitura on fiscal_eventos
  for select using (fiscal_usuario_ativo());

drop policy if exists fiscal_hist_precos_leitura on fiscal_historico_precos;
create policy fiscal_hist_precos_leitura on fiscal_historico_precos
  for select using (fiscal_usuario_ativo());

-- Fila de processamento e logs: internos, só admin/master enxergam.
drop policy if exists fiscal_fila_admin on fiscal_processing_queue;
create policy fiscal_fila_admin on fiscal_processing_queue
  for select using (fiscal_is_admin());

drop policy if exists fiscal_logs_admin on fiscal_logs;
create policy fiscal_logs_admin on fiscal_logs
  for select using (fiscal_is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- 10. STORAGE — buckets privados (certificado e XML)
-- ═══════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('fiscal-certificados', 'fiscal-certificados', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('fiscal-xml', 'fiscal-xml', false)
on conflict (id) do nothing;

-- Acesso direto do navegador a estes buckets fica restrito a master/admin
-- (leitura só para conferência pontual); o fluxo normal de download de XML
-- passa pela Edge Function fiscal-document-xml, que confere a permissão
-- fiscal.download_xml antes de servir o arquivo (Fase 12).
drop policy if exists fiscal_certificados_bucket_admin on storage.objects;
create policy fiscal_certificados_bucket_admin on storage.objects
  for all using (bucket_id = 'fiscal-certificados' and fiscal_is_admin())
  with check (bucket_id = 'fiscal-certificados' and fiscal_is_admin());

drop policy if exists fiscal_xml_bucket_admin on storage.objects;
create policy fiscal_xml_bucket_admin on storage.objects
  for all using (bucket_id = 'fiscal-xml' and fiscal_is_admin())
  with check (bucket_id = 'fiscal-xml' and fiscal_is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- NOTA — Supabase Vault (senha do certificado)
-- ═══════════════════════════════════════════════════════════════════
-- A extensão "supabase_vault" já vem habilitada por padrão em projetos
-- Supabase atuais. A gravação da senha (vault.create_secret(...)) e a
-- leitura (vault.decrypted_secrets, só acessível à service role) só
-- acontecem dentro da Edge Function fiscal-certificate (Etapa 13.2) —
-- não há nada a rodar aqui além de confirmar, no painel do Supabase
-- (Database → Extensions), que "supabase_vault" está ativa.

-- =====================================================================
-- FIM — Etapa 13.1
-- Depois de rodar: conferir "Database → Tables" (9 tabelas fiscal_* +
-- 2 colunas novas em fornecedores + 2 colunas novas em
-- fornecedor_item_nomenclatura) e "Storage" (2 buckets privados novos).
-- =====================================================================
