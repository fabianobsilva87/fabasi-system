# Edge Function `fiscal-certificate` — Etapa 13.2

⚠️ **Este código nunca foi executado.** Foi escrito sem acesso a um projeto Supabase real nem a um certificado A1 — precisa ser testado por você, com cuidado, antes de confiar nele.

## Pré-requisitos

1. As duas migrations já executadas, **nesta ordem**:
   - `migrations/2026-08-29_fiscal_modulo_etapa13-1.sql`
   - `migrations/2026-08-29_vault-wrappers_etapa13-2.sql`
2. Extensão `supabase_vault` ativa (Database → Extensions no painel Supabase).
3. Uma linha em `empresa_master` com o CNPJ real da Fabasi já cadastrado (para a checagem de CNPJ do certificado bater com a empresa).
4. [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado (`supabase login`), projeto linkado (`supabase link --project-ref mqijbvcnalbfjbhhjjzx`).

## Deploy

```bash
supabase functions deploy fiscal-certificate
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já ficam disponíveis **automaticamente** no ambiente de toda Edge Function — não precisa (e não dá pra) setar isso via `supabase secrets set`, a CLI bloqueia qualquer nome de secret começando com `SUPABASE_` de propósito, exatamente para não sobrescrever esses valores injetados pela plataforma. `supabase secrets set` só é necessário para segredos de terceiros (ex.: uma chave de API externa) — este projeto não tem nenhum por enquanto.

## Checklist de teste (nessa ordem — não pule etapas)

1. **Teste com senha errada de propósito primeiro.** Confirme que a resposta é o erro genérico ("Não foi possível utilizar o certificado. Verifique a senha.") e que nada é gravado em `fiscal_certificados`.
2. **Cadastre o certificado real** (ação `cadastrar`) com `ambiente_padrao: 'homologacao'`. Confira no painel Supabase:
   - `Storage → fiscal-certificados`: o arquivo `.pfx` apareceu, bucket continua privado.
   - `Database → fiscal_certificados`: uma linha nova, com `cnpj_certificado` extraído corretamente e `senha_secret_id` preenchido (nunca a senha em si).
   - `Database → fiscal_certificado_auditoria`: uma linha `acao='cadastrado'`.
   - Rode `select decrypted_secret from vault.decrypted_secrets` **direto no SQL Editor como você** (não como a function) — isso **deve falhar ou não retornar nada útil** se as permissões do Vault estiverem corretas; só a service role consegue ler de verdade.
3. **Teste o certificado** (ação `testar`) — isso hoje só reabre o arquivo com a senha guardada e confirma a validade; a chamada real à SEFAZ (`NFeStatusServico`) está **deliberadamente comentada** no código (ver `index.ts`) porque `Deno.createHttpClient` com certificado cliente (mTLS) é a parte mais arriscada de testar sem supervisão — habilite só depois que os passos 1-2 estiverem 100% confirmados, e teste primeiro contra o ambiente de homologação da SEFAZ.
4. Só depois disso, considere partir para a Etapa 13.4 (sincronização real via `distNSU`).

## O que fazer se algo falhar

- **Erro de import `npm:node-forge`**: nem toda versão do runtime de Edge Functions do Supabase suporta specifiers `npm:` da mesma forma — se a function não subir, verifique a versão do Deno usada pelo Supabase (`supabase functions deploy --help` mostra a versão) e ajuste a versão do `node-forge` ou troque por outra lib de PKCS#12 compatível com Deno puro se necessário.
- **CNPJ do certificado não bate com Empresa Master**: a function retorna HTTP 409 com `error: 'cnpj_diferente'` — é proposital (Regra da Fase 4 do documento de arquitetura). Reenvie com `confirmar_cnpj_diferente: true` só se isso for esperado (ex.: certificado de uma filial).
