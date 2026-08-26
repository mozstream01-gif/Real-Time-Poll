import { DataTypes, Model } from "sequelize";
import { sequelize } from "../connection.js";

export class PollOption extends Model {}

PollOption.init(
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
    label: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "#6366f1",
    },
  },
  {
    sequelize,
    modelName: "PollOption",
    tableName: "poll_options",
    timestamps: false,
  }
);
