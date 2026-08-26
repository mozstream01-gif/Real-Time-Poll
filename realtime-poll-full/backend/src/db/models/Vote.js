import { DataTypes, Model } from "sequelize";
import { sequelize } from "../connection.js";

export class Vote extends Model {}

Vote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pollId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    optionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    userName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Vote",
    tableName: "votes",
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        // Constraint única a nível de banco: garante que (pollId, userId)
        // só pode aparecer uma vez, mesmo sob concorrência (dois votos
        // simultâneos do mesmo utilizador não passam os dois).
        unique: true,
        fields: ["poll_id", "user_id"],
        name: "unique_vote_per_user_per_poll",
      },
    ],
  }
);
