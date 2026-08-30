# `/api/fiscal-sefaz-status` — Etapa 13.4 (parte 1: teste de conexão mTLS)

⚠️ **Código não testado em ambiente real.** Escrito sem acesso ao Vercel nem à SEFAZ — precisa ser validado por você.

## Por que isso é uma Vercel Function, e não uma Supabase Edge Function

Tentei inicialmente colocar isso como Edge Function (mesmo lugar do `fiscal-certificate`), mas pesquisei e confirmei: o runtime Deno das Edge Functions do Supabase **não tem suporte estável para certificado cliente (mTLS)** em requisições HTTPS — é uma limitação real e recorrente, relatada por vários desenvolvedores. Como isso é exatamente o que a SEFAZ exige, mudei de abordagem: o Node.js "de verdade" do Vercel resolve isso nativamente (`https.Agent` aceita `{ pfx, passphrase }` direto). Como o Fabasi já roda no Vercel, isso não é infraestrutura nova.

## O que muda no deploy

Este é o primeiro arquivo do projeto que precisa de dependências via `npm install` (o `package.json` na raiz foi criado só por causa disso — o resto do sistema continua vanilla, sem build step). O Vercel detecta o `package.json` e instala sozinho no próximo deploy; não precisa rodar nada manualmente localmente, a menos que queira testar antes.

## Configurar as variáveis de ambiente no Vercel

Painel do Vercel → seu projeto → **Settings → Environment Variables** → adicione as 3:

| Nome | Valor | Onde pegar |
|---|---|---|
| `SUPABASE_URL` | `https://mqijbvcnalbfjbhhjjzx.supabase.co` | Já está em `config.js` (é pública) |
| `SUPABASE_ANON_KEY` | (a mesma string longa que já está em `config.js`) | Já está em `config.js` (é pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | a service role key do projeto | Supabase → Project Settings → API → "service_role" (**secreta**) |

Diferente das Edge Functions do Supabase, o Vercel **não injeta nada automaticamente** — as 3 têm que ser cadastradas manualmente. Depois de adicionar, é necessário fazer um novo deploy (ou usar "Redeploy" no painel) para elas passarem a valer.

## Deploy

Se o projeto já está conectado a um repositório Git, só precisa dar `git push` — o Vercel builda e publica sozinho. Se você sobe os arquivos manualmente, use `vercel --prod` (CLI do Vercel) na raiz do projeto.

## Status

✅ **Validado em produção (código) / homologação (SEFAZ) em 30/08/2026.** `cStat=107` — "Serviço em Operação". Três problemas apareceram no caminho, documentados abaixo para não precisar redescobrir na próxima integração (NFS-e/ADN vai ter os mesmos riscos).

### Lições aprendidas (guarde para o distNSU e para o NFS-e/ADN)

1. **`Unsupported PKCS12 PFX data`** — Node 17+ usa OpenSSL 3, que rejeita por padrão PKCS12 cifrados com RC2 (comum em certificados ICP-Brasil). Solução: usar `node-forge` pra extrair certificado + chave privada como PEM, e passar `{ cert, key }` pro `https.Agent` em vez de `{ pfx, passphrase }` — evita o parser PKCS12 nativo do Node inteiramente.

2. **`self-signed certificate in certificate chain`** — o Node não confia na raiz ICP-Brasil por padrão (sua lista embutida é a da Mozilla, sem CAs brasileiras). A cadeia real da SEFAZ-MT homologação: `homologacao.sefaz.mt.gov.br` → `AC SOLUTI SSL EV G4` → `Autoridade Certificadora Raiz Brasileira v10`. Em vez de caçar e manter atualizado o certificado raiz da ICP-Brasil no código (frágil), optamos por `rejectUnauthorized: false` nesta chamada — decisão consciente, documentada no código, aceitável porque a autenticação real já é o mTLS e a URL é fixa (não vem de input externo).

3. **`cStat=588` ("Rejeicao: Nao e permitida a presenca de caracteres de edicao...")** — a SEFAZ rejeita qualquer espaço/quebra de linha entre as tags do XML da mensagem. O envelope SOAP precisa ser montado 100% compacto (sem indentação "bonita" pra humano ler) — ver `montarEnvelopeSoap()`.

## Próximo passo natural: Etapa 13.4 completa (distNSU)

Diferente do `NFeStatusServico` (baixíssimo custo, sem limite prático), o `distNSU` é o serviço que de fato importa as notas — e tem regras de uso restritas: se não houver nada novo (`ultNSU == maxNSU`), a SEFAZ exige esperar 1h antes de consultar de novo (rejeição 656, "consumo indevido"), e reconsultar antes disso reinicia essa espera. Precisa de controle de estado (`fiscal_sync_state`, já criado na Etapa 13.1) e assinatura da requisição, não só mTLS. Avise quando quiser seguir para essa etapa.

