import { useEffect, useRef, useState } from "react";
import { API_URL } from "./lib/config.js";
import { getUserId, getStoredUserName, setStoredUserName } from "./lib/userId.js";
import { usePoll } from "./hooks/usePoll.js";
import { NameEntry } from "./components/NameEntry.jsx";
import { LiveBadge } from "./components/LiveBadge.jsx";
import { VotingPanel } from "./components/VotingPanel.jsx";
import { ResultsChart } from "./components/ResultsChart.jsx";

function useActivePoll() {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/polls/active`)
      .then((r) => {
        if (!r.ok) throw new Error("Não foi possível carregar a votação ativa.");
        return r.json();
      })
      .then((data) => !cancelled && setPoll(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return { poll, error };
}

function useFlashOnNewVote(results) {
  const [flashOptionId, setFlashOptionId] = useState(null);
  const prevRef = useRef(null);

  useEffect(() => {
    if (!results) return;
    const prev = prevRef.current;
    if (prev) {
      const changed = results.options.find((o) => {
        const before = prev.options.find((p) => p.id === o.id);
        return before && o.votes > before.votes;
      });
      if (changed) {
        setFlashOptionId(changed.id);
        const t = setTimeout(() => setFlashOptionId(null), 500);
        return () => clearTimeout(t);
      }
    }
    prevRef.current = results;
  }, [results]);

  return flashOptionId;
}

export default function App() {
  const { poll, error: pollError } = useActivePoll();
  const [userName, setUserName] = useState(getStoredUserName);
  const [userId] = useState(getUserId);

  const { connected, results, onlineCount, myVoteOptionId, voteError, isVoting, castVote } = usePoll({
    pollId: poll?.id ?? null,
    userId,
    userName,
  });

  const flashOptionId = useFlashOnNewVote(results);

  if (pollError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="mb-1 text-sm font-medium text-[var(--color-danger)]">Algo correu mal</p>
          <p className="text-sm text-[var(--color-text-muted)]">{pollError}</p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-xs tracking-[0.2em] text-[var(--color-text-faint)] uppercase">
          A carregar…
        </span>
      </div>
    );
  }

  if (!userName) {
    return (
      <NameEntry
        question={poll.question}
        onSubmit={(name) => {
          setStoredUserName(name);
          setUserName(name);
        }}
      />
    );
  }

  const hasVoted = myVoteOptionId !== null;
  const options = results?.options ?? poll.options.map((o) => ({ ...o, votes: 0, percentage: 0 }));
  const totalVotes = results?.totalVotes ?? 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-faint)] uppercase">
            Real-Time Poll
          </span>
          <LiveBadge connected={connected} onlineCount={onlineCount} />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]">
          <p className="mb-1 text-[11px] font-medium tracking-wide text-[var(--color-text-faint)] uppercase">
            Olá, {userName.split(" ")[0]}
          </p>
          <h1 className="mb-6 font-[var(--font-display)] text-xl leading-snug font-semibold text-[var(--color-text)]">
            {results?.question ?? poll.question}
          </h1>

          {!hasVoted ? (
            <VotingPanel
              options={poll.options}
              onVote={castVote}
              isVoting={isVoting}
              voteError={voteError}
            />
          ) : (
            <ResultsChart options={options} myVoteOptionId={myVoteOptionId} flashOptionId={flashOptionId} />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between px-1 font-mono text-[11px] text-[var(--color-text-faint)]">
          <span>{hasVoted ? "Resultados atualizados em tempo real" : "Escolhe uma opção para votar"}</span>
          <span className="tabular-nums">{totalVotes} voto{totalVotes === 1 ? "" : "s"} no total</span>
        </div>
      </div>
    </div>
  );
}
