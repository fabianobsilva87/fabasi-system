-- =====================================================================
--  FABASI — AUDITORIA GERAL DO SISTEMA
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- CONTEXTO: o sistema já guarda "quem criou"/"quem aprovou" como campos
-- soltos em várias tabelas (criado_por_nome, aprovado_por_nome), e o
-- Fiscal já tem um log específico pra certificado (fiscal_certificado_
-- auditoria). Mas EDIÇÕES e EXCLUSÕES não ficam registradas em lugar
-- nenhum — se alguém editar um valor de uma Ordem de Compra ou excluir
-- uma Conta a Pagar, não sobra rastro.
--
-- Em vez de espalhar chamadas de log pelo código JS de cada tela (fácil
-- de esquecer em algum lugar, e não pega quem editar direto via API),
-- a auditoria roda via TRIGGER de banco — pega qualquer INSERT/UPDATE/
-- DELETE nas tabelas escolhidas, não importa por onde a mudança chegou.
-- =====================================================================

create table if not exists auditoria_sistema (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  acao text not null,                 -- INSERT | UPDATE | DELETE
  usuario_id uuid references auth.users(id),
  usuario_nome text,                  -- null = alteração feita pelo sistema (Edge/Vercel Function via service role)
  dados_antigos jsonb,
  dados_novos jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_auditoria_tabela   on auditoria_sistema (tabela);
create index if not exists idx_auditoria_registro on auditoria_sistema (registro_id);
create index if not exists idx_auditoria_usuario  on auditoria_sistema (usuario_id);
create index if not exists idx_auditoria_data     on auditoria_sistema (created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- Função genérica de auditoria — SECURITY DEFINER pra sempre conseguir
-- gravar o log, mesmo que o usuário comum não tenha INSERT liberado
-- direto na tabela auditoria_sistema (só admin lê, ninguém escreve à
-- mão — é sempre via trigger).
-- ═══════════════════════════════════════════════════════════════════
create or replace function fn_auditoria_generica() returns trigger
language plpgsql security definer as $$
declare
  v_nome text;
  v_registro_id uuid;
begin
  select nome into v_nome from profiles where id = auth.uid();

  begin
    v_registro_id := (case when TG_OP = 'DELETE' then old.id else new.id end);
  exception when others then
    v_registro_id := null; -- tabela sem coluna "id" (não deveria acontecer, mas não quebra o trigger original)
  end;

  insert into auditoria_sistema (tabela, registro_id, acao, usuario_id, usuario_nome, dados_antigos, dados_novos)
  values (
    TG_TABLE_NAME, v_registro_id, TG_OP, auth.uid(), v_nome,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- Aplicando nas tabelas mais sensíveis (dinheiro, aprovação, cadastro
-- estrutural). fiscal_certificados fica de fora de propósito — já tem
-- fiscal_certificado_auditoria dedicado, não precisa duplicar.
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tabelas text[] := array[
    'contas_pagar', 'contas_pagar_parcelas',
    'contas_receber', 'contas_receber_parcelas',
    'requisicoes_material', 'requisicoes_compra', 'ordens_compra',
    'obras', 'centros_custo', 'plano_contas',
    'fornecedores', 'bancario_movimentos'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_auditoria_generica on %I', t);
    execute format('create trigger trg_auditoria_generica after insert or update or delete on %I for each row execute function fn_auditoria_generica()', t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — só admin/master lê; ninguém insere/edita/exclui
-- diretamente (a tabela só é escrita pelo trigger, que roda como
-- SECURITY DEFINER e ignora RLS na escrita).
-- ═══════════════════════════════════════════════════════════════════
alter table auditoria_sistema enable row level security;

drop policy if exists auditoria_sistema_leitura on auditoria_sistema;
create policy auditoria_sistema_leitura on auditoria_sistema for select using (fiscal_is_admin());

-- =====================================================================
-- FIM
-- Teste rápido: edite qualquer Conta a Pagar e confira se apareceu uma
-- linha nova em auditoria_sistema com acao='UPDATE' e dados_antigos/
-- dados_novos preenchidos.
-- =====================================================================
