import { sequelize } from "../connection.js";
import { Poll } from "./Poll.js";
import { PollOption } from "./PollOption.js";
import { Vote } from "./Vote.js";

// Poll 1—N PollOption
Poll.hasMany(PollOption, { foreignKey: "pollId", as: "options", onDelete: "CASCADE" });
PollOption.belongsTo(Poll, { foreignKey: "pollId", as: "poll" });

// Poll 1—N Vote
Poll.hasMany(Vote, { foreignKey: "pollId", as: "votes", onDelete: "CASCADE" });
Vote.belongsTo(Poll, { foreignKey: "pollId", as: "poll" });

// PollOption 1—N Vote
PollOption.hasMany(Vote, { foreignKey: "optionId", as: "votes", onDelete: "CASCADE" });
Vote.belongsTo(PollOption, { foreignKey: "optionId", as: "option" });

export { sequelize, Poll, PollOption, Vote };
