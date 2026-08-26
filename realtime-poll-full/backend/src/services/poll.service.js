import { sequelize, Poll, PollOption, Vote } from "../db/models/index.js";
import { ValidationError as SequelizeValidationError, UniqueConstraintError } from "sequelize";

export class DuplicateVoteError extends Error {
  constructor(message = "Já votaste nesta votação.") {
    super(message);
    this.name = "DuplicateVoteError";
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Retorna a poll ativa (a mais recente com isActive = true), com as suas opções.
 */
export async function getActivePoll() {
  const poll = await Poll.findOne({
    where: { isActive: true },
    include: [{ model: PollOption, as: "options" }],
    order: [["createdAt", "DESC"]],
  });

  if (!poll) {
    throw new NotFoundError("Não existe nenhuma votação ativa no momento.");
  }

  return poll;
}

/**
 * Calcula os resultados agregados de uma poll: total de votos e,
 * por opção, a contagem e a percentagem (arredondada a 1 casa decimal).
 */
export async function getPollResults(pollId) {
  const poll = await Poll.findByPk(pollId, {
    include: [{ model: PollOption, as: "options" }],
  });

  if (!poll) {
    throw new NotFoundError(`Votação #${pollId} não encontrada.`);
  }

  // Conta votos agrupados por optionId numa única query.
  const counts = await Vote.findAll({
    where: { pollId },
    attributes: ["optionId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["optionId"],
    raw: true,
  });

  const countsByOption = new Map(
    counts.map((c) => [Number(c.optionId ?? c.option_id), Number(c.count)])
  );
  const totalVotes = counts.reduce((sum, c) => sum + Number(c.count), 0);

  const options = poll.options.map((option) => {
    const votes = countsByOption.get(option.id) ?? 0;
    const percentage = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10;
    return {
      id: option.id,
      label: option.label,
      color: option.color,
      votes,
      percentage,
    };
  });

  return {
    pollId: poll.id,
    question: poll.question,
    totalVotes,
    options,
  };
}

/**
 * Regista um voto. Lança DuplicateVoteError se o utilizador já tiver
 * votado nesta poll (aplicado via constraint única no banco, para ser
 * seguro mesmo sob concorrência — não depende só de checagem prévia).
 */
export async function castVote({ pollId, optionId, userId, userName }) {
  const poll = await Poll.findByPk(pollId);
  if (!poll || !poll.isActive) {
    throw new NotFoundError("Esta votação não está disponível.");
  }

  const option = await PollOption.findOne({ where: { id: optionId, pollId } });
  if (!option) {
    throw new NotFoundError("Opção inválida para esta votação.");
  }

  try {
    await Vote.create({ pollId, optionId, userId, userName });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new DuplicateVoteError();
    }
    if (err instanceof SequelizeValidationError) {
      throw new Error(err.message);
    }
    throw err;
  }

  return getPollResults(pollId);
}

/**
 * Indica se um dado userId já votou numa poll (usado para restaurar o
 * estado do cliente quando ele recarrega a página).
 */
export async function hasUserVoted(pollId, userId) {
  const vote = await Vote.findOne({ where: { pollId, userId } });
  return vote ? vote.optionId : null;
}
