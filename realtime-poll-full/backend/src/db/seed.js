import "dotenv/config";
import { sequelize, Poll, PollOption } from "./models/index.js";

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await Poll.findOne({ where: { isActive: true } });
  if (existing) {
    console.log(`Já existe uma poll ativa (#${existing.id}). Nada a fazer.`);
    process.exit(0);
  }

  const poll = await Poll.create({
    question: "Qual é a sua linguagem de programação favorita?",
    isActive: true,
  });

  await PollOption.bulkCreate([
    { pollId: poll.id, label: "JavaScript", color: "#3178c6" },
    { pollId: poll.id, label: "Python", color: "#2f9e44" },
    { pollId: poll.id, label: "Java", color: "#e8b400" },
    { pollId: poll.id, label: "PHP", color: "#e64980" },
  ]);

  console.log(`✅ Poll de exemplo criada (id=${poll.id}) com 4 opções.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao correr o seed:");
  if (err.name === "SequelizeConnectionRefusedError" || err.original?.code === "ECONNREFUSED") {
    console.error("   → Não foi possível ligar ao MySQL na porta 3306. O serviço MySQL está ativo?");
  } else if (err.original?.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("   → Acesso negado. Confirma o utilizador e a palavra-passe no DATABASE_URL (.env).");
  } else if (err.original?.code === "ER_BAD_DB_ERROR") {
    console.error("   → A base de dados não existe. Cria-a com: CREATE DATABASE realtime_poll;");
  } else {
    console.error("   →", err.message || err);
  }
  process.exit(1);
});
