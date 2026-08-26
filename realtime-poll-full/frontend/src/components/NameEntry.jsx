import { useState } from "react";

export function NameEntry({ onSubmit, question }) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (isValid) onSubmit(trimmed);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-signal)]"
              style={{ animation: "pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-signal)]"
              style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
            />
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-faint)] uppercase">
            Real-Time Poll
          </span>
        </div>

        <h1 className="mb-2 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
          Entra na votação
        </h1>
        {question && (
          <p className="mb-8 text-sm leading-relaxed text-[var(--color-text-muted)]">
            A pergunta desta ronda: <span className="text-[var(--color-text)]">&ldquo;{question}&rdquo;</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
              O teu nome
            </label>
            <input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Ex: Isley"
              maxLength={40}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none transition-colors focus:border-[var(--color-signal)]"
            />
            {touched && !isValid && (
              <p className="mt-1.5 text-xs text-[var(--color-danger)]">Escreve pelo menos 2 caracteres.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full rounded-lg bg-[var(--color-signal)] px-4 py-2.5 text-sm font-semibold text-[#0A1310] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--color-text-faint)]">
          Não é preciso conta nem palavra-passe — apenas um nome para
          identificarmos o teu voto nesta sessão.
        </p>
      </div>
    </div>
  );
}
