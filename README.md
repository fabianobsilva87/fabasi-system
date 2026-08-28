# Fabasi — Sistema de Gestão

Sistema web de gestão de manutenção, ativos e ordens de serviço da **Fabasi Engenharia & Construção**.

Stack: HTML + CSS + JavaScript puro (sem framework/build step), backend em [Supabase](https://supabase.com) (Auth + PostgreSQL). PDF.js para leitura de PDF em navegador, xlsx.js para exportação de planilhas, qrcode.js para geração de QR Codes.

## Estrutura

```
config.js                 → credenciais Supabase (URL + anon key)
app.js                     → toda a lógica compartilhada entre páginas (~5.500 linhas)
style.css                  → estilos globais
index.html                 → login
dashboard.html              → painel geral
equipamentos.html           → cadastro de ativos
gerir-equipamentos.html     → inventário e gerenciamento de ativos
pmoc.html                   → ficha digital de inspeção PMOC
programacao-pmoc.html       → programação/cronograma de manutenções PMOC
plano-pmoc.html             → geração do documento Plano PMOC
os.html                     → ordens de serviço (climatização + facilities)
colaborador.html            → colaboradores e cargos/funções
empresas.html                → empresas executantes/contratantes
locais.html                  → hierarquia de locais e carga térmica
usuarios.html                → gestão de usuários e níveis de acesso
impressoes.html               → central de impressões (laudos, etiquetas, capas, relatórios)
verificar.html                → verificação pública de autenticidade de documento (QR Code)
diagnostico.html              → ferramenta de diagnóstico de login (não faz parte do fluxo do usuário final)
logo-fabasi.png / favicon.ico → identidade visual (placeholder — ver nota abaixo)
```

## Rodando localmente

Não há build step. Basta servir os arquivos estáticos:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

`config.js` já aponta para o projeto Supabase de produção da Fabasi — não é necessário nenhum passo extra de configuração para rodar localmente.

## Verificação de integridade

O projeto tem uma suíte própria de checks estáticos (sem dependências) em `ci-checks.js`:

```bash
node ci-checks.js
```

Verifica: sintaxe do `app.js`, blocos `<script>` inline válidos, handlers `onclick`/`onchange` sem função correspondente, colisões de nome entre `app.js` e páginas, IDs HTML duplicados, consistência do menu lateral entre páginas, sincronia do checklist PMOC (definições × formulário × guia de execução), fonte única do piso de adequação térmica, e rotinas de impressão chamadas por nome que realmente existem.

**Estado atual: 7/9 checks passam.** Duas falhas conhecidas e pendentes:
- Item `bio_06` do checklist PMOC sem campo correspondente no formulário.
- Três botões em `impressoes.html` chamam rotinas de impressão (`imprimirEtiquetaBebedouro`, `imprimirEtiquetaLimpezaClimatizador`, `imprimirEtiquetaLimpezaVentilador`) ainda não implementadas em `app.js`.

## Nota sobre a logo

`logo-fabasi.png` (e o mesmo asset embutido em base64 na constante `LOGO_ETIQUETA` em `app.js`, usada nos laudos/etiquetas/capas impressos) é um **placeholder gerado**, não a arte final da marca. Assim que a logo definitiva da Fabasi estiver pronta, substituir nesses dois lugares.

## Deploy

Publicado via Vercel. `vercel.json` define `Cache-Control: no-cache, no-store, must-revalidate` para `.html`, `.js` e `config.js` — importante manter esse header em `config.js` especificamente, para que trocas de credenciais/ambiente se propaguem imediatamente sem cache de CDN/navegador.

## Origem deste repositório

Este código nasceu como ambiente de homologação de um sistema de manutenção predial (Concredur/Univag) e foi rebrandizado e adotado como o sistema definitivo da Fabasi em agosto de 2026. O banco de dados Supabase usado é o que antes era o ambiente de homologação daquele projeto — ver comentário em `config.js` para detalhes.
