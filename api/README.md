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

## `/api/fiscal-distnsu-sync` — Etapa 13.4 completa (importação real de notas)

⚠️ **Código não testado contra documentos reais.** A mecânica mTLS/envelope já foi validada (mesmo certificado, mesmo tipo de chamada), mas esta function nunca rodou contra o `distNSU` de verdade — só o `NFeStatusServico` foi confirmado.

### O que é diferente do `NFeStatusServico`

- **Endpoint é nacional** (Ambiente Nacional), não por estado: `hom1.nfe.fazenda.gov.br` / `www1.nfe.fazenda.gov.br` — não usa mais o domínio `sefaz.mt.gov.br`. ⚠️ Cuidado: `hom.nfe.fazenda.gov.br` (sem o "1") foi **desativado em 23/05/2022** especificamente para o `NFeDistribuicaoDFe` — só existe o `hom1`. Foi exatamente esse engano que causou um "The resource cannot be found" no primeiro teste real.
- **Não precisa de assinatura digital** na requisição (só mTLS) — confirmado via [nfephp-org/sped-nfe](https://github.com/nfephp-org/sped-nfe/blob/master/docs/metodos/DistDFe.md), biblioteca de referência da comunidade. Isso contraria o que o documento de arquitetura original supunha.
- **Tem estado** (`fiscal_sync_state`, tabela criada na Etapa 13.1): cada chamada usa o `ultimo_nsu` salvo, e só avança esse valor depois de processar a resposta com sucesso — nunca antes.
- **Regra de bloqueio de 1h** (rejeição 656, "consumo indevido"): se não há nada novo (`ultNSU == maxNSU`), a function já marca `proxima_tentativa_permitida` = agora + 1h automaticamente, e todo `POST` seguinte é recusado (HTTP 429) até esse horário passar — mesmo se você clicar em "Sincronizar Agora" de novo.
- **Resposta pode vir com vários documentos gzipados** (`<docZip>`), cada um decodificado via `zlib.gunzipSync` e parseado (`api/_lib/parser-distnsu.js`, testado com XMLs sintéticos de `resNFe` e `procNFe` — não com XML real da SEFAZ).
- **Limite de 30 documentos por chamada** (`MAX_DOCS_POR_CHAMADA`) — proteção contra timeout da function serverless. Se houver mais que isso pendente, uma próxima chamada continua de onde parou (o NSU só avança até onde foi processado).

### Checklist de teste (com ainda mais cautela que o NFeStatusServico)

1. **Primeira chamada em homologação**: clique em "Sincronizar Agora" em `fiscal-config.html`. É bem provável que não haja nenhum documento de teste disponível no ambiente de homologação vinculado ao seu certificado — nesse caso espera-se `cStat=137` ("nenhum documento localizado") e a resposta deve indicar `nada_novo: true`.
2. **Confira no painel**: `fiscal_sync_state` deve ter uma linha com `ultimo_nsu`/`maior_nsu` preenchidos e `proxima_tentativa_permitida` setada (já que não há nada novo). `fiscal_logs` deve ter o registro da chamada.
3. **NÃO clique de novo antes da 1h** — o botão vai recusar (HTTP 429) e mostrar quando pode tentar de novo, mas evite forçar isso via chamada direta à API ignorando a UI.
4. Se em algum momento houver documentos de teste disponíveis (a SEFAZ eventualmente disponibiliza XMLs de exemplo em homologação para o certificado testado), confira: `fiscal_documentos` recebeu a linha, `fiscal_documento_itens` (se for `procNFe`) recebeu os itens, `fornecedores` ganhou um pré-cadastro se o CNPJ emitente não existia.
5. **Se der erro de parsing** (documento processado mas campos vazios/errados): provável que o layout real do XML da SEFAZ tenha alguma diferença do que assumi em `api/_lib/parser-distnsu.js` — me manda o XML (depois de descompactado) que eu ajusto o parser.

