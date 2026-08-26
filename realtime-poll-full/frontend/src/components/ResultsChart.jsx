import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export function ResultsChart({ options = [], myVoteOptionId, flashOptionId }) {
  const sorted = [...options].sort((a, b) => b.votes - a.votes);

  const data = {
    labels: sorted.map((o) => o.label),
    datasets: [
      {
        data: sorted.map((o) => o.percentage),
        backgroundColor: sorted.map((o) =>
          o.id === myVoteOptionId ? o.color : `${o.color}B3`
        ),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 26,
      },
    ],
  };

  const config = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 420, easing: "easeOutQuart" },
    layout: { padding: { right: 8 } },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: { color: "#2A3140" },
        border: { display: false },
        ticks: {
          color: "#5C6577",
          font: { family: "JetBrains Mono", size: 10 },
          callback: (v) => `${v}%`,
          stepSize: 25,
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#E7EAF0",
          font: { family: "Inter", size: 12, weight: "500" },
        },
      },
    },
    plugins: {
      tooltip: {
        backgroundColor: "#212733",
        borderColor: "#3A4356",
        borderWidth: 1,
        titleFont: { family: "Inter", size: 12 },
        bodyFont: { family: "JetBrains Mono", size: 12 },
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => {
            const opt = sorted[ctx.dataIndex];
            return `${opt.votes} voto${opt.votes === 1 ? "" : "s"} · ${opt.percentage}%`;
          },
        },
      },
      legend: { display: false },
    },
  };

  const height = Math.max(sorted.length * 46, 120);

  return (
    <div>
      <div style={{ height }}>
        <Bar data={data} options={config} />
      </div>

      <ul className="mt-2 space-y-1.5">
        {sorted.map((option) => (
          <li
            key={option.id}
            className={`flex items-center justify-between rounded-md px-1.5 py-1 text-xs transition-colors ${
              flashOptionId === option.id ? "animate-bar-flash" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} />
              <span className="text-[var(--color-text-muted)]">{option.label}</span>
              {option.id === myVoteOptionId && (
                <span className="rounded-full bg-[var(--color-signal-dim)] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[var(--color-signal)] uppercase">
                  O teu voto
                </span>
              )}
            </div>
            <span className="font-mono tabular-nums text-[var(--color-text)]">
              {option.votes} <span className="text-[var(--color-text-faint)]">· {option.percentage}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
