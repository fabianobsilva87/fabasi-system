#!/usr/bin/env bash
# =====================================================================
#  CONCREDUR — T4.2: fixar versões de CDN e gerar hashes SRI
#
#  POR QUE ISTO É UM SCRIPT E NÃO UMA ALTERAÇÃO JÁ APLICADA:
#  calcular um hash SRI exige baixar o arquivo exato da CDN. Um hash
#  inventado faz o navegador BLOQUEAR o script e derruba o sistema
#  inteiro — é pior que não ter SRI nenhum. O mesmo vale para fixar uma
#  versão que não existe: o CDN devolve 404 e a página morre.
#
#  USO:  bash scripts/gerar-sri.sh
#  Requer: curl e openssl. Rode a partir da raiz do projeto.
# =====================================================================
set -euo pipefail

# ── 1. Descubra a versão exata que o "@2" está resolvendo hoje ────────
echo "== Versão atual resolvida pelo range aberto =="
VERSAO_SUPABASE=$(curl -sSL -o /dev/null -w '%{url_effective}' \
  "https://unpkg.com/@supabase/supabase-js@2" | sed -E 's#.*supabase-js@([^/]+).*#\1#')
echo "  @supabase/supabase-js  → ${VERSAO_SUPABASE}"
echo

# ── 2. Gere o hash de cada dependência ────────────────────────────────
sri() {
  local url="$1"
  local hash
  hash=$(curl -sSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)
  printf '  %s\n    integrity="sha384-%s"\n\n' "$url" "$hash"
}

echo "== Hashes SRI =="
sri "https://unpkg.com/@supabase/supabase-js@${VERSAO_SUPABASE}/dist/umd/supabase.js"
sri "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
sri "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"

cat <<'FIM'
== Como aplicar ==

Nas 12 páginas, troque:

  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>

por (usando a versão e o hash impressos acima):

  <script src="https://unpkg.com/@supabase/supabase-js@X.Y.Z/dist/umd/supabase.js"
          integrity="sha384-..."
          crossorigin="anonymous"></script>

E acrescente integrity + crossorigin="anonymous" aos scripts de qrcodejs e xlsx,
que já estão com versão fixa (1.0.0 e 0.18.5) mas sem verificação de integridade.

Substituição em massa (invariante 4 — injeção estática, nunca via DOM):

  python3 - <<'PY'
  import glob
  ANTIGO = '<script src="https://unpkg.com/@supabase/supabase-js@2"></script>'
  NOVO   = ('<script src="https://unpkg.com/@supabase/supabase-js@X.Y.Z/dist/umd/supabase.js" '
            'integrity="sha384-COLE_AQUI" crossorigin="anonymous"></script>')
  for f in glob.glob('*.html'):
      s = open(f, encoding='utf-8').read()
      if ANTIGO in s:
          open(f, 'w', encoding='utf-8').write(s.replace(ANTIGO, NOVO))
          print('ok', f)
  PY

== Depois de aplicar, TESTE ANTES DE PUBLICAR ==
Abra uma página e confirme no console que não há
"Failed to find a valid digest in the 'integrity' attribute".
Se aparecer, o hash está errado e o Supabase não carregará — reverta.

== Alternativa mais robusta ==
Auto-hospedar as três bibliotecas em /vendor/ elimina a dependência de CDN,
o risco de breaking change silenciosa e a necessidade de SRI.
FIM
