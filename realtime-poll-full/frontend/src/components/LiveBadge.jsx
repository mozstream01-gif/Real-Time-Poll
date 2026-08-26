export function LiveBadge({ connected, onlineCount }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {connected && (
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-signal)]"
              style={{ animation: "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite" }}
            />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              connected ? "bg-[var(--color-signal)]" : "bg-[var(--color-text-faint)]"
            }`}
            style={connected ? { animation: "pulse-dot 1.8s ease-in-out infinite" } : undefined}
          />
        </span>
        <span
          className={`font-mono text-[11px] tracking-[0.18em] uppercase ${
            connected ? "text-[var(--color-signal)]" : "text-[var(--color-text-faint)]"
          }`}
        >
          {connected ? "Ao vivo" : "A ligar…"}
        </span>
      </div>

      <div className="h-3 w-px bg-[var(--color-border-strong)]" />

      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="opacity-70">
          <path
            d="M17 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-mono text-[12px] tabular-nums">{onlineCount}</span>
        <span className="text-[11px]">online</span>
      </div>
    </div>
  );
}
