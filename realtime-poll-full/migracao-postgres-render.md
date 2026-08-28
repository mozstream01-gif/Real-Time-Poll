# Migração SQLite → PostgreSQL + Deploy no Render

## 1. Contexto

O backend está atualmente a usar **SQLite** (ficheiro local). Para hospedar
no **Render**, é preciso mudar para uma base de dados que corra como
serviço de rede — SQLite não serve para isso, porque é um ficheiro no
disco local do processo, e o Render não garante disco persistente entre
deploys/restarts nos planos gratuitos de Web Service.

**PostgreSQL** é a escolha natural aqui porque:
- O Render oferece PostgreSQL gerido nativamente (plano gratuito incluído).
- Sequelize suporta Postgres de forma madura, sem mudar a estrutura do código — só o "dialect" e o driver.
- É o standard de facto para deploys Node.js modernos (mais fácil de justificar numa entrevista técnica do que SQLite, que é pensado para dev local/embedded).

---

## 2. O que muda na arquitetura

| Antes (SQLite) | Depois (PostgreSQL) |
|---|---|
| `sqlite3` (driver) | `pg` + `pg-hstore` (driver) |
| Ficheiro local `.sqlite` | Serviço de rede (Postgres gerido no Render) |
| `dialect: "sqlite", storage: "./dev.db"` | `dialect: "postgres"` + `DATABASE_URL` |
| Sem SSL | SSL obrigatório em produção (Render exige) |
| Nada a configurar em rede | `DATABASE_URL` fornecida automaticamente pelo Render |

**O que NÃO muda:**
- Models Sequelize (`Poll`, `PollOption`, `Vote`) — ficam exatamente iguais.
- A constraint única `(poll_id, user_id)` que impede voto duplicado — Postgres suporta índices únicos compostos da mesma forma.
- Toda a lógica de negócio (`poll.service.js`), rotas REST e handlers de Socket.IO — zero alterações.
- `sequelize.sync()` continua a funcionar, criando as tabelas automaticamente no arranque.

Ou seja: a migração é **só na camada de conexão à base de dados** — não mexe em nada do domínio da aplicação. Isto é intencional (é uma das vantagens de usar um ORM): trocar o motor de banco não deveria implicar reescrever lógica de negócio.

---

## 3. Passo a passo técnico

### 3.1. Trocar as dependências

```bash
npm uninstall sqlite3
npm install pg pg-hstore
```

### 3.2. Atualizar `src/db/connection.js`

```js
import { Sequelize } from "sequelize";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Configura o ficheiro .env.");
}

const isProduction = process.env.NODE_ENV === "production";

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: "postgres",
  logging: process.env.SQL_LOGGING === "true" ? console.log : false,
  define: {
    underscored: true,
  },
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false, // necessário para o certificado gerido do Render
        },
      }
    : {},
});
```

> **Porquê `rejectUnauthorized: false`?** O Postgres gerido do Render usa um
> certificado que não está na cadeia de confiança padrão do Node em todos
> os ambientes. Isto é uma prática comum e aceite para serviços geridos
> deste tipo — não é o mesmo que desligar SSL (a ligação continua
> encriptada), só relaxa a validação da cadeia do certificado.

### 3.3. Atualizar `.env` e `.env.example`

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME"
PORT=4000
CORS_ORIGIN=https://o-teu-frontend.onrender.com
NODE_ENV=production
```

Localmente, para testar antes do deploy, podes correr Postgres via Docker:

```bash
docker run --name poll-postgres -e POSTGRES_PASSWORD=poll_pass \
  -e POSTGRES_DB=realtime_poll -p 5432:5432 -d postgres:16
```

E usar `DATABASE_URL="postgresql://postgres:poll_pass@localhost:5432/realtime_poll"` (sem SSL, já que é local — `NODE_ENV` diferente de `production` desliga o bloco `dialectOptions`).

### 3.4. Models e seed — sem alterações

`Poll.js`, `PollOption.js`, `Vote.js`, `index.js` (associações) e
`seed.js` continuam exatamente iguais. O Sequelize traduz os tipos
automaticamente (`INTEGER autoIncrement` → `SERIAL` no Postgres, etc.).

---

## 4. Deploy no Render

### 4.1. Criar a base de dados PostgreSQL

1. No dashboard do Render → **New** → **PostgreSQL**.
2. Dá um nome (ex: `realtime-poll-db`), escolhe a região mais próxima do teu Web Service (idealmente a mesma, para latência menor).
3. Plano **Free** chega perfeitamente para este desafio.
4. Depois de criada, o Render mostra várias connection strings — usa a **Internal Database URL** para o teu backend (mais rápida, não sai da rede interna do Render) em vez da External.

### 4.2. Criar o Web Service do backend

1. **New** → **Web Service** → liga ao teu repositório GitHub (o backend pode estar numa subpasta, ex: `/backend` — o Render permite definir o **Root Directory**).
2. Configurações:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
3. Variáveis de ambiente (separador **Environment**):
   - `DATABASE_URL` → cola a **Internal Database URL** que o Render gerou no passo anterior
   - `NODE_ENV` → `production`
   - `CORS_ORIGIN` → o URL do teu frontend (vais preencher depois de publicares o frontend — podes deixar um valor temporário e atualizar depois)
   - `PORT` → o Render já injeta a sua própria porta automaticamente via `process.env.PORT`; o teu `src/index.js` já lê `process.env.PORT || 4000`, por isso não precisas de definir isto manualmente (mas não faz mal se definires)
4. Depois do primeiro deploy, corre o seed **uma vez** através do **Shell** do Render (aba "Shell" do próprio Web Service):
   ```bash
   npm run seed
   ```

> **WebSocket**: o Render suporta WebSocket persistente nativamente nos
> Web Services (ao contrário de plataformas serverless tipo Vercel
> Functions) — não precisas de nenhuma configuração extra para o
> Socket.IO funcionar.

### 4.3. Publicar o frontend

1. **New** → **Static Site** (o frontend é só ficheiros estáticos após o build).
2. Liga ao mesmo repositório:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Variável de ambiente:
   - `VITE_API_URL` → o URL público do teu Web Service backend (ex: `https://realtime-poll-backend.onrender.com`)
4. Depois de publicado, copia o URL do frontend (ex: `https://realtime-poll-frontend.onrender.com`) e volta ao Web Service do backend para atualizar `CORS_ORIGIN` com esse valor exato — depois faz **Manual Deploy** → **Deploy latest commit** para aplicar.

### 4.4. Notas sobre o plano gratuito

- Web Services gratuitos do Render "adormecem" após ~15 min de inatividade e demoram uns segundos a "acordar" no próximo pedido — normal para uma demo/candidatura, mas explica isto se quem avaliar notar uma primeira resposta lenta.
- A base de dados gratuita do Render tem um limite de tempo de vida (atualmente ~30-90 dias dependendo do plano vigente) — vale a pena confirmar no dashboard antes da avaliação, para garantir que não expira antes de submeteres.

---

## 5. Checklist final

- [ ] `npm uninstall sqlite3 && npm install pg pg-hstore`
- [ ] Atualizar `connection.js` (dialect `postgres` + SSL condicional)
- [ ] Atualizar `.env.example` com formato `postgresql://...`
- [ ] Testar localmente com Postgres (Docker ou instância local)
- [ ] Criar PostgreSQL no Render
- [ ] Criar Web Service (backend) com `DATABASE_URL`, `NODE_ENV`, `CORS_ORIGIN`
- [ ] Correr `npm run seed` via Shell do Render
- [ ] Criar Static Site (frontend) com `VITE_API_URL`
- [ ] Atualizar `CORS_ORIGIN` no backend com o URL final do frontend e re-deploy
- [ ] Testar o fluxo completo em produção (votar em duas abas, confirmar tempo real)
- [ ] Enviar link da app + link do GitHub para avaliação
