-- =====================================================================
--  FABASI — TRAVA DE EDIÇÃO/EXCLUSÃO: RM e SC convertidas
--  Migration versionada — EXECUÇÃO MANUAL no Supabase SQL Editor
-- =====================================================================
--
-- Contexto: uma Requisição de Material (RM), depois de convertida em
-- Solicitação de Compra (status='Convertida'), continuava editável e
-- excluível na tela — mesma coisa para Solicitação de Compra (SC) depois
-- de convertida em Ordem de Compra. Isso abre risco de duplicidade (ex.:
-- editar uma RM já convertida não reflete na SC gerada, ou excluir uma RM
-- já usada deixa a SC "órfã" sem rastreabilidade).
--
-- A tela já foi corrigida (botões somem, funções JS bloqueiam), mas isso
-- sozinho não impede uma chamada direta à API contornando a interface —
-- por isso a trava real fica aqui, no banco, via trigger.
-- =====================================================================

create or replace function fn_bloquear_edicao_apos_convertida() returns trigger
language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.status = 'Convertida' then
      raise exception 'Este registro já foi convertido e usado em outro processo — não pode ser excluído.';
    end if;
    return OLD;
  end if;

  -- UPDATE: bloqueia qualquer edição se JÁ estava convertida antes desta
  -- operação (a transição PARA 'Convertida' continua permitida, é
  -- exatamente o que o botão "Converter"/"Iniciar Cotação" faz).
  if OLD.status = 'Convertida' then
    raise exception 'Este registro já foi convertido e usado em outro processo — não pode mais ser editado.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_bloquear_edicao_rm on requisicoes_material;
create trigger trg_bloquear_edicao_rm
  before update or delete on requisicoes_material
  for each row execute function fn_bloquear_edicao_apos_convertida();

drop trigger if exists trg_bloquear_edicao_rc on requisicoes_compra;
create trigger trg_bloquear_edicao_rc
  before update or delete on requisicoes_compra
  for each row execute function fn_bloquear_edicao_apos_convertida();

-- =====================================================================
-- FIM
-- Teste rápido depois de rodar: tente editar ou excluir (pela tela, ou
-- direto no SQL Editor) uma RM/SC com status='Convertida' — deve dar
-- erro. Uma RM/SC com status diferente de 'Convertida' continua editável
-- normalmente.
-- =====================================================================
