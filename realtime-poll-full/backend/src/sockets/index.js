import { castVote, getPollResults, DuplicateVoteError, NotFoundError } from "../services/poll.service.js";

// Mapa em memória: pollId -> Set de socket.id ligados a essa poll.
// Serve só para contar utilizadores online por votação; os votos em si
// são sempre persistidos no banco (isto não é a fonte de verdade dos dados).
const onlineByPoll = new Map();

function roomName(pollId) {
  return `poll:${pollId}`;
}

function getOnlineSet(pollId) {
  if (!onlineByPoll.has(pollId)) onlineByPoll.set(pollId, new Set());
  return onlineByPoll.get(pollId);
}

async function broadcastResults(io, pollId) {
  try {
    const results = await getPollResults(pollId);
    io.to(roomName(pollId)).emit("results:update", results);
  } catch (err) {
    console.error(`Falha ao recalcular resultados da poll ${pollId}:`, err.message);
  }
}

function broadcastPresence(io, pollId) {
  const onlineCount = getOnlineSet(pollId).size;
  io.to(roomName(pollId)).emit("presence:update", { pollId, onlineCount });
}

export function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // Guarda a qual poll este socket está associado, para limpar no disconnect.
    let joinedPollId = null;

    socket.on("poll:join", async ({ pollId }) => {
      if (!pollId) return;

      // Sai da room anterior, se existir (evita ficar "preso" a duas polls).
      if (joinedPollId !== null && joinedPollId !== pollId) {
        socket.leave(roomName(joinedPollId));
        getOnlineSet(joinedPollId).delete(socket.id);
        broadcastPresence(io, joinedPollId);
      }

      joinedPollId = pollId;
      socket.join(roomName(pollId));
      getOnlineSet(pollId).add(socket.id);

      broadcastPresence(io, pollId);

      // Envia o estado atual dos resultados só para quem acabou de entrar.
      try {
        const results = await getPollResults(pollId);
        socket.emit("results:update", results);
      } catch (err) {
        socket.emit("vote:error", { message: err.message });
      }
    });

    socket.on("vote:cast", async ({ pollId, optionId, userId, userName }) => {
      if (!pollId || !optionId || !userId || !userName) {
        socket.emit("vote:error", { message: "Dados de voto incompletos." });
        return;
      }

      try {
        await castVote({ pollId, optionId, userId, userName: String(userName).slice(0, 120) });

        socket.emit("vote:success", { optionId });

        // Notifica TODOS os clientes na room (incluindo quem votou) com
        // os totais recalculados — é isto que faz o gráfico atualizar
        // "sozinho" em todos os ecrãs conectados.
        await broadcastResults(io, pollId);
      } catch (err) {
        if (err instanceof DuplicateVoteError) {
          socket.emit("vote:error", { message: err.message, code: "ALREADY_VOTED" });
        } else if (err instanceof NotFoundError) {
          socket.emit("vote:error", { message: err.message, code: "NOT_FOUND" });
        } else {
          console.error("Erro ao registar voto:", err);
          socket.emit("vote:error", { message: "Erro interno ao registar o voto." });
        }
      }
    });

    socket.on("disconnect", () => {
      if (joinedPollId !== null) {
        getOnlineSet(joinedPollId).delete(socket.id);
        broadcastPresence(io, joinedPollId);
      }
    });
  });
}
