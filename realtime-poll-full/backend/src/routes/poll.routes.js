import { Router } from "express";
import { getActivePoll, getPollResults, hasUserVoted, NotFoundError } from "../services/poll.service.js";

export const pollRouter = Router();

// GET /api/polls/active
// Retorna a poll ativa com as suas opções (sem contagens — usar /results para isso).
pollRouter.get("/active", async (req, res, next) => {
  try {
    const poll = await getActivePoll();
    res.json({
      id: poll.id,
      question: poll.question,
      options: poll.options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/polls/:id/results
// Retorna os resultados agregados (totais e percentagens) de uma poll.
pollRouter.get("/:id/results", async (req, res, next) => {
  try {
    const results = await getPollResults(Number(req.params.id));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/polls/:id/my-vote?userId=xxx
// Diz ao frontend se este userId já votou (e em quê), para restaurar o
// estado da UI quando a página é recarregada.
pollRouter.get("/:id/my-vote", async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId é obrigatório." });

    const optionId = await hasUserVoted(Number(req.params.id), String(userId));
    const hasVoted = optionId !== null && optionId !== undefined;
    res.json({ hasVoted, optionId: hasVoted ? optionId : null });
  } catch (err) {
    next(err);
  }
});

pollRouter.use((err, req, res, next) => {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  next(err);
});
