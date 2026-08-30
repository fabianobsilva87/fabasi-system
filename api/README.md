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

## Teste

Em `fiscal-config.html`, com um certificado já cadastrado e válido (Etapa 13.2, que você já confirmou funcionando), clique em **"Testar Conexão SEFAZ (real)"**. Isso faz uma chamada real, porém de **baixíssimo custo** (`NFeStatusServico` — não consome cota de importação de notas), à SEFAZ-MT em homologação.

- **Se der `cStat=107`** ("Serviço em Operação"): mTLS funcionou de ponta a ponta — o certificado autenticou de verdade junto à SEFAZ. 🎉 Esse é o sinal verde pra seguirmos com o `distNSU` de verdade (Etapa 13.4 completa).
- **Qualquer outro erro**: me manda a mensagem exata. Os pontos mais prováveis de falhar, na minha ordem de suspeita:
  1. Variável de ambiente faltando/errada no Vercel.
  2. URL do webservice de MT desatualizada (confirmei via [nfephp-org/sped-nfe](https://github.com/nfephp-org/sped-nfe), referência mantida pela comunidade, mas SEFAZ pode ter mudado o endereço).
  3. Estrutura do envelope SOAP (o XML dentro de `montarEnvelopeSoap()`) não bater exatamente com o que a SEFAZ-MT espera — cada estado pode ter pequenas variações apesar do padrão nacional.
  4. `rejectUnauthorized` — se a SEFAZ usar uma cadeia de certificados que o Node não reconhece por padrão, pode ser preciso ajustar `ca` no `https.Agent`.
