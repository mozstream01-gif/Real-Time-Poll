import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { sequelize } from "./db/models/index.js";
import { seedDatabase } from "./db/seed.js";
import { pollRouter } from "./routes/poll.routes.js";
import { registerSocketHandlers } from "./sockets/index.js";

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN || "http://localhost:5173";

// Suporte a multiplas origens separadas por virgula ou wildcard '*'
const allowedOrigins = CORS_ORIGIN_ENV === "*"
  ? "*"
  : CORS_ORIGIN_ENV.split(",").map((s) => s.trim());

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

const app = express();

// Habilita trust proxy para deploy atras de reverse proxies (Render, Railway, Nginx, Vercel)
app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/api/polls", pollRouter);

// Handler de erro generico
app.use((err, req, res, next) => {
  console.error("[ERROR] Erro nao tratado:", err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

registerSocketHandlers(io);

let serverInstance;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("[INFO] Ligacao a base de dados estabelecida.");

    // Sincroniza tabelas e modelos
    await sequelize.sync();
    console.log("[INFO] Modelos sincronizados com o banco.");

    // Auto-seed para deployments sem intervencao manual (Render, Railway, etc.)
    if (process.env.AUTO_SEED !== "false") {
      await seedDatabase({ silent: true });
    }

    serverInstance = httpServer.listen(PORT, () => {
      console.log(`[INFO] Servidor pronto em http://localhost:${PORT}`);
      console.log(`[INFO] Origens CORS permitidas: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(", ") : allowedOrigins}`);
    });
  } catch (err) {
    console.error("[ERROR] Falha ao iniciar o servidor:");
    if (err.name === "SequelizeConnectionRefusedError" || err.original?.code === "ECONNREFUSED") {
      console.error("   -> Nao foi possivel ligar ao MySQL. O servico MySQL esta ativo na porta 3306?");
      console.error("   -> Se o MySQL estiver noutra porta ou maquina, ajusta DATABASE_URL no ficheiro backend/.env.");
    } else if (err.original?.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   -> Acesso negado. Confirma o utilizador e a palavra-passe no DATABASE_URL (.env).");
    } else if (err.original?.code === "ER_BAD_DB_ERROR") {
      console.error("   -> A base de dados nao existe. Cria-a com: CREATE DATABASE realtime_poll;");
    } else {
      console.error("   ->", err.message || err);
    }
    process.exit(1);
  }
}

// Encerramento gracioso em sinais de orquestradores (Docker, Kubernetes, Render)
function gracefulShutdown(signal) {
  console.log(`\n[INFO] Sinal ${signal} recebido. A encerrar o servidor graciosamente...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      try {
        await sequelize.close();
        console.log("[INFO] Conexao a base de dados encerrada com sucesso.");
      } catch (e) {
        console.error("[ERROR] Erro ao encerrar base de dados:", e);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start();
