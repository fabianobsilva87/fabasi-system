# Concredur — Sistema de Gestão de Manutenção
**Versão:** 2.0  |  **Stack:** HTML + CSS + JavaScript + Supabase

---

## Arquivos do Projeto

| Arquivo | Descrição |
|---|---|
| `index.html` | Página de login (não modificada — use o original) |
| `dashboard.html` | Dashboard executivo com gráficos e alertas |
| `equipamentos.html` | Cadastro de novo ativo de refrigeração |
| `gerir-equipamentos.html` | Gerenciamento e listagem de ativos |
| `pmoc.html` | Formulário PMOC |
| `os.html` | Ordens de Serviço (Climatização + Facilities + Central) |
| `empresas.html` | Cadastro de Empresa Empregadora, Contratantes e Responsável de Segurança |
| `colaborador.html` | Ficha completa de colaborador + geração de PDFs (Registro, EPI, Certificados NR) |
| `usuarios.html` | Gestão de acesso ao sistema |
| `app.js` | Toda a lógica do sistema |
| `style.css` | Estilos globais |
| `supabase_setup.sql` | Script completo de criação do banco (idempotente — pode re-executar) |
| `README.md` | Este arquivo |

---

## Passo a Passo para Deploy do Zero

### 1. SUPABASE (banco de dados)

1. Acesse https://supabase.com e crie uma conta
2. Crie um novo projeto (anote a **URL** e a **anon key**)
3. Vá em **SQL Editor** e execute o arquivo `supabase_setup.sql` inteiro
4. Vá em **Authentication → Settings** e **desmarque** "Enable email confirmations"
5. Vá em **Authentication → Users → Add User** e crie seu usuário admin
6. Copie o UUID do usuário e execute no SQL Editor:

```sql
INSERT INTO profiles (id, email, nome, role, status)
VALUES (
  'COLE-O-UUID-AQUI',
  'seu@email.com',
  'Administrador',
  'admin',
  'ativo'
);
```

### 2. CREDENCIAIS NO app.js

Abra `app.js` e substitua as linhas 6 e 7:

```javascript
const SUPABASE_URL      = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-ANON-KEY-AQUI";
```

### 3. GITHUB (repositório)

```bash
git init
git add .
git commit -m "Deploy Concredur v2.0"
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

### 4. VERCEL (hospedagem gratuita)

1. Acesse https://vercel.com
2. **Add New Project → Import Git Repository**
3. Conecte ao GitHub e selecione o repositório
4. Clique em **Deploy** (sem configuração adicional — é HTML puro)
5. Aguarde ~30 segundos e acesse a URL gerada

---

## Configuração Inicial no Sistema

Após o primeiro login, configure na ordem:

1. **🏢 Empresas** → Cadastre a Empresa Empregadora (CNPJ, endereço) e o Responsável de Segurança
2. **👷 Ficha de Colaborador → Cargos e Funções** → Cadastre os cargos
3. **👷 Ficha de Colaborador → Colaboradores** → Registre os técnicos
4. **⚙️ Equipamentos** → Cadastre os ativos de refrigeração

---

## Tabelas do Banco de Dados

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários do sistema |
| `funcoes` | Cargos e funções (Junior / Pleno / Sênior) |
| `colaboradores` | Técnicos de campo (simplificado, para O.S.) |
| `colaboradores_completo` | Ficha completa do colaborador (eSocial) |
| `equipamentos` | Ativos de refrigeração |
| `fichas_pmoc` | Fichas de manutenção preventiva |
| `ordens_servico` | O.S. de climatização |
| `ordens_servico_geral` | O.S. de facilities |
| `empresas` | Empresas empregadoras e contratantes |
| `responsaveis_seguranca` | Responsáveis técnicos de segurança |

---

## Geração de PDFs (colaborador.html)

| Documento | Formato | Observações |
|---|---|---|
| Ficha de Registro | A4 Portrait | Modelo eSocial fiel |
| Comprovante de EPI | A4 Portrait | Modelo Fabasi com 6 compromissos |
| Certificados NR (5 NRs) | A4 Landscape | 2 páginas por certificado |

### Lógica de Datas dos Certificados NR
As datas são calculadas automaticamente a partir da data de admissão, considerando apenas dias úteis (seg–sex):
- **NR-18 Integração** → Dia da admissão (6h)
- **NR-06** → 1º dia útil seguinte (8h)
- **NR-12/18 Betoneira** → 2º dia útil seguinte (8h)
- **NR-18 Andaimes** → 3º dia útil seguinte (8h)
- **NR-35** → 4º dia útil seguinte (8h)

---

## Dica — Limite de Deploys Vercel (plano gratuito)

O plano gratuito tem limite de 100 deploys/dia.
Agrupe várias alterações em um único commit antes de fazer push.
