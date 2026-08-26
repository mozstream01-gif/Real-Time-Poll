import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL, API_URL } from "../lib/config.js";

/**
 * Encapsula toda a interação com o backend para uma poll específica:
 * - abre e mantém a ligação Socket.IO
 * - entra na "room" da poll (poll:join)
 * - escuta results:update e presence:update
 * - expõe castVote() e o estado local de "já votei em X"
 */
export function usePoll({ pollId, userId, userName }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [results, setResults] = useState(null); // { question, totalVotes, options[] }
  const [onlineCount, setOnlineCount] = useState(0);
  const [myVoteOptionId, setMyVoteOptionId] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  // Ao montar: verifica via REST se este userId já votou e obtém resultados iniciais
  useEffect(() => {
    if (!pollId) return;
    let cancelled = false;

    if (userId) {
      fetch(`${API_URL}/api/polls/${pollId}/my-vote?userId=${encodeURIComponent(userId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.hasVoted) setMyVoteOptionId(data.optionId);
        })
        .catch(() => {});
    }

    fetch(`${API_URL}/api/polls/${pollId}/results`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.options) setResults(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pollId, userId]);

  useEffect(() => {
    if (!pollId) return;

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("poll:join", { pollId });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("results:update", (data) => {
      setResults(data);
    });

    socket.on("presence:update", (data) => {
      setOnlineCount(data.onlineCount);
    });

    socket.on("vote:success", ({ optionId }) => {
      setMyVoteOptionId(optionId);
      setIsVoting(false);
      setVoteError(null);
    });

    socket.on("vote:error", ({ message, code }) => {
      setIsVoting(false);
      setVoteError(message);
      if (code === "ALREADY_VOTED") {
        // O servidor sabe mais do que nós: sincroniza o estado local.
        fetch(`${API_URL}/api/polls/${pollId}/my-vote?userId=${encodeURIComponent(userId)}`)
          .then((r) => r.json())
          .then((data) => data.hasVoted && setMyVoteOptionId(data.optionId))
          .catch(() => {});
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [pollId, userId]);

  const castVote = useCallback(
    (optionId) => {
      if (!socketRef.current || myVoteOptionId !== null || isVoting) return;
      setIsVoting(true);
      setVoteError(null);
      socketRef.current.emit("vote:cast", { pollId, optionId, userId, userName });
    },
    [pollId, userId, userName, myVoteOptionId, isVoting]
  );

  return { connected, results, onlineCount, myVoteOptionId, voteError, isVoting, castVote };
}
