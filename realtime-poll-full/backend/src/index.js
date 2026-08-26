import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { sequelize } from "./db/models/index.js";
import { pollRouter } from "./routes/poll.routes.js";
import { registerSocketHandlers } from "./sockets/index.js";

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/polls", pollRouter);

// Handler de erro genérico (fallback para erros não tratados nas rotas)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

registerSocketHandlers(io);

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Ligação à base de dados estabelecida.");

    // Em produção o ideal é usar migrations reais; para simplificar o
    // setup deste desafio, sincronizamos os models diretamente.
    await sequelize.sync();
    console.log("✅ Modelos sincronizados com o banco.");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Falha ao iniciar o servidor:");
    if (err.name === "SequelizeConnectionRefusedError" || err.original?.code === "ECONNREFUSED") {
      console.error("   → Não foi possível ligar ao MySQL. O serviço MySQL está ativo na porta 3306?");
      console.error("   → Se o MySQL estiver noutra porta ou máquina, ajusta DATABASE_URL no ficheiro backend/.env.");
    } else if (err.original?.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   → Acesso negado. Confirma o utilizador e a palavra-passe no DATABASE_URL (.env).");
    } else if (err.original?.code === "ER_BAD_DB_ERROR") {
      console.error("   → A base de dados não existe. Cria-a com: CREATE DATABASE realtime_poll;");
    } else {
      console.error("   →", err.message || err);
    }
    process.exit(1);
  }
}

start();
