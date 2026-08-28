import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sequelize, Poll, PollOption } from "./models/index.js";

export async function seedDatabase({ silent = false } = {}) {
  const existing = await Poll.findOne({ where: { isActive: true } });
  if (existing) {
    if (!silent) console.log(`[INFO] Ja existe uma poll ativa (#${existing.id}).`);
    return existing;
  }

  const poll = await Poll.create({
    question: "Qual e a sua linguagem de programacao favorita?",
    isActive: true,
  });

  await PollOption.bulkCreate([
    { pollId: poll.id, label: "JavaScript", color: "#3178c6" },
    { pollId: poll.id, label: "Python", color: "#2f9e44" },
    { pollId: poll.id, label: "Java", color: "#e8b400" },
    { pollId: poll.id, label: "PHP", color: "#e64980" },
  ]);

  if (!silent) console.log(`[INFO] Poll de exemplo criada (id=${poll.id}) com 4 opcoes.`);
  return poll;
}

// Execucao direta via CLI (npm run seed)
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  (async () => {
    try {
      await sequelize.authenticate();
      await sequelize.sync();
      await seedDatabase();
      process.exit(0);
    } catch (err) {
      console.error("[ERROR] Erro ao correr o seed:");
      if (err.name === "SequelizeConnectionRefusedError" || err.original?.code === "ECONNREFUSED") {
        console.error("   -> Nao foi possivel ligar a base de dados na porta 5432. O servico esta ativo?");
      } else if (err.original?.code === "28P01" || err.original?.code === "ER_ACCESS_DENIED_ERROR") {
        console.error("   -> Acesso negado. Confirma o utilizador e a palavra-passe no DATABASE_URL (.env).");
      } else if (err.original?.code === "3D000" || err.original?.code === "ER_BAD_DB_ERROR") {
        console.error("   -> A base de dados nao existe. Cria-a com: CREATE DATABASE realtime_poll;");
      } else {
        console.error("   ->", err.message || err);
      }
      process.exit(1);
    }
  })();
}
