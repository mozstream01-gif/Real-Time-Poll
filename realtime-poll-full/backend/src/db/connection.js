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


