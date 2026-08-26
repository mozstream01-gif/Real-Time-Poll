export function VotingPanel({ options, onVote, isVoting, voteError }) {
  return (
    <div className="space-y-2.5">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onVote(option.id)}
          disabled={isVoting}
          className="group flex w-full items-center gap-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-left transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125"
            style={{ backgroundColor: option.color }}
          />
          <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{option.label}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[var(--color-text-faint)] opacity-0 transition-opacity group-hover:opacity-100"
          >
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}

      {voteError && (
        <p className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-xs text-[var(--color-danger)]">
          {voteError}
        </p>
      )}
    </div>
  );
}
