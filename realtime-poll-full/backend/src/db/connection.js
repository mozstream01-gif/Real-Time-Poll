import { Sequelize } from "sequelize";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || "sqlite:./database.sqlite";

const baseOptions = {
  logging: process.env.SQL_LOGGING === "true" ? console.log : false,
  define: {
    underscored: true, // colunas em snake_case (created_at, poll_id, etc.)
  },
};

export const sequelize = DATABASE_URL.startsWith("sqlite:")
  ? new Sequelize({
      dialect: "sqlite",
      storage: path.isAbsolute(DATABASE_URL.replace("sqlite:", ""))
        ? DATABASE_URL.replace("sqlite:", "")
        : path.resolve(__dirname, "../../", DATABASE_URL.replace("sqlite:", "") || "database.sqlite"),
      ...baseOptions,
    })
  : new Sequelize(DATABASE_URL, {
      dialect: "mysql",
      ...baseOptions,
    });

