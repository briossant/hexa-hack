import { useState, useEffect } from 'react';

interface ModelStats {
  model_name: string;
  games_played: number;
  mean_survival_rounds: number;
  games_survived: number;
  survival_rate_pct: number | string;
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-orange-400',
};

function SurvivalBar({ pct }: { pct: number | string }) {
  const value = Math.min(Number(pct), 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 h-1 rounded-full bg-mauve/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-coral transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-medium text-mauve/60 tabular-nums w-9 text-right">
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-8 py-5 animate-pulse">
      <div className="w-6 h-3 rounded bg-mauve/10" />
      <div className="flex-1 h-3 rounded bg-mauve/10" />
      <div className="w-10 h-3 rounded bg-mauve/10" />
      <div className="w-8 h-3 rounded bg-mauve/10" />
      <div className="w-28 h-3 rounded bg-mauve/10" />
    </div>
  );
}

export default function Leaderboard() {
  const [models, setModels] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/models')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((data: ModelStats[]) => {
        setModels(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col divide-y divide-mauve/8">
        {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-mauve/50 text-sm py-12">
        Could not load rankings.
      </p>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-14 px-8">
        <p className="text-ink font-medium text-sm">No games recorded yet.</p>
        <p className="text-mauve/50 text-xs mt-2">Play a game to start the benchmark.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[36px_1fr_100px_60px_160px] gap-x-8 px-10 pt-7 pb-4 text-[10px] uppercase tracking-widest font-semibold text-mauve/35">
        <span>#</span>
        <span>Model</span>
        <span className="text-right">Avg rounds</span>
        <span className="text-right">Games</span>
        <span className="text-right pr-1">Survival rate</span>
      </div>

      <div className="flex flex-col">
        {models.map((m, i) => {
          const rank = i + 1;
          const rankColor = RANK_COLORS[rank] ?? 'text-mauve/30';
          const isTop = rank === 1;

          return (
            <div
              key={m.model_name}
              className={[
                'grid grid-cols-[36px_1fr_100px_60px_160px] gap-x-8 items-center px-10 py-5 transition-colors border-t border-mauve/8',
                isTop ? 'bg-coral/[0.03]' : 'hover:bg-mauve/[0.02]',
              ].join(' ')}
            >
              {/* Rank */}
              <span className={`text-xs font-bold tabular-nums ${rankColor}`}>
                {rank}
              </span>

              {/* Model name */}
              <span
                className="font-mono text-sm text-ink truncate"
                title={m.model_name}
              >
                {m.model_name}
              </span>

              {/* Avg survival */}
              <div className="text-right">
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {Number(m.mean_survival_rounds).toFixed(1)}
                </span>
                <span className="text-[10px] text-mauve/40 ml-1">rounds</span>
              </div>

              {/* Games played */}
              <span className="text-sm text-mauve/50 tabular-nums text-right">
                {m.games_played}
              </span>

              {/* Survival bar */}
              <div className="flex justify-end">
                <SurvivalBar pct={m.survival_rate_pct} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-mauve/25 text-center py-5">
        Ranked by average rounds survived before detection
      </p>
    </div>
  );
}
