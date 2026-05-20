import { useState, useEffect } from 'react';
import type {
  PatternStatsByModelResponse,
  ModelPatternStats,
} from '@hexa-hack/shared';

interface ModelStats {
  model_name: string;
  games_played: number;
  mean_survival_rounds: number;
  games_survived: number;
  survival_rate_pct: number | string;
}

type SortKey = 'rank' | 'model_name' | 'mean_survival_rounds' | 'games_played' | 'survival_rate_pct';
type SortDir = 'asc' | 'desc';

const RANK_COLORS: Record<number, string> = {
  1: 'text-amber-500',
  2: 'text-slate-400',
  3: 'text-orange-400',
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`inline-block ml-1 transition-opacity ${active ? 'opacity-80' : 'opacity-20'}`}
    >
      {dir === 'asc' || !active ? (
        <polyline points="2,7 5,3 8,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <polyline points="2,3 5,7 8,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className={`text-mauve/40 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="4,2 8,6 4,10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function ModelDetailPanel({ stats }: { stats: ModelPatternStats | null | undefined }) {
  if (stats === undefined) {
    return (
      <div className="px-10 py-5 bg-mauve/[0.02] text-xs text-mauve/50">
        Loading detection details…
      </div>
    );
  }
  if (stats === null || stats.bots_count === 0) {
    return (
      <div className="px-10 py-5 bg-mauve/[0.02] text-xs text-mauve/60">
        No bots from this model have been analyzed yet.
      </div>
    );
  }
  if (stats.patterns.length === 0) {
    return (
      <div className="px-10 py-5 bg-mauve/[0.02] text-xs text-mauve/60">
        {stats.bots_count} bot{stats.bots_count !== 1 ? 's' : ''} analyzed, no patterns surfaced.
      </div>
    );
  }
  return (
    <div className="px-10 py-5 bg-mauve/[0.02]">
      <p className="text-[10px] uppercase tracking-widest text-mauve/50 font-semibold mb-3">
        Detection patterns · based on {stats.bots_count} analyzed bot
        {stats.bots_count !== 1 ? 's' : ''}
      </p>
      <div className="flex flex-col gap-2">
        {stats.patterns.map((p) => (
          <div key={p.label} className="grid grid-cols-[1fr_120px_70px] gap-x-4 items-center" title={p.description}>
            <span className="text-xs text-ink truncate">{p.headline}</span>
            <div className="w-full h-1 rounded-full bg-mauve/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-coral/70"
                style={{ width: `${p.bots_affected_pct}%` }}
              />
            </div>
            <div className="text-right text-xs tabular-nums">
              <span className="font-semibold text-ink">{p.bots_affected_pct}%</span>
              <span className="text-mauve/40 ml-1">
                ({p.bots_affected}/{stats.bots_count})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sortModels(models: ModelStats[], key: SortKey, dir: SortDir): ModelStats[] {
  return [...models].sort((a, b) => {
    let va: number | string;
    let vb: number | string;

    if (key === 'rank') {
      va = Number(a.mean_survival_rounds);
      vb = Number(b.mean_survival_rounds);
      return dir === 'asc' ? vb - va : va - vb;
    } else if (key === 'model_name') {
      va = a.model_name.toLowerCase();
      vb = b.model_name.toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    } else {
      va = Number(a[key]);
      vb = Number(b[key]);
      return dir === 'asc' ? va - vb : vb - va;
    }
  });
}

export default function Leaderboard() {
  const [models, setModels] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);
  // null = not loaded, Map entry = loaded; missing key = not analyzed
  const [patternByModel, setPatternByModel] = useState<Map<string, ModelPatternStats> | null>(null);

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

  useEffect(() => {
    fetch('/analyzer/stats/patterns/by-model')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((data: PatternStatsByModelResponse) => {
        const map = new Map<string, ModelPatternStats>();
        for (const m of data.models) map.set(m.model_name, m);
        setPatternByModel(map);
      })
      .catch(() => {
        setPatternByModel(new Map());
      });
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'model_name' || key === 'rank' ? 'asc' : 'desc');
    }
  };

  const sorted = sortModels(models, sortKey, sortDir);

  const colHeader = (label: string, key: SortKey, className = '') => (
    <button
      onClick={() => handleSort(key)}
      className={`flex items-center gap-0.5 uppercase tracking-widest text-[10px] font-semibold transition-colors hover:text-mauve/70 ${sortKey === key ? 'text-mauve/60' : 'text-mauve/35'} ${className}`}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  );

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
      <div className="grid grid-cols-[24px_36px_1fr_100px_60px_160px] gap-x-6 px-10 pt-7 pb-4">
        <span />
        {colHeader('#', 'rank')}
        {colHeader('Model', 'model_name')}
        <div className="flex justify-end">{colHeader('Avg rounds', 'mean_survival_rounds')}</div>
        <div className="flex justify-end">{colHeader('Games', 'games_played')}</div>
        <div className="flex justify-end pr-1">{colHeader('Survival rate', 'survival_rate_pct')}</div>
      </div>

      <div className="flex flex-col">
        {sorted.map((m, i) => {
          const rank = i + 1;
          const rankColor = RANK_COLORS[rank] ?? 'text-mauve/30';
          const isTop = rank === 1;
          const isOpen = expanded === m.model_name;

          return (
            <div key={m.model_name} className="border-t border-mauve/8">
              <button
                onClick={() => setExpanded(isOpen ? null : m.model_name)}
                aria-expanded={isOpen}
                className={[
                  'w-full grid grid-cols-[24px_36px_1fr_100px_60px_160px] gap-x-6 items-center px-10 py-5 text-left transition-colors',
                  isTop ? 'bg-coral/[0.03]' : 'hover:bg-mauve/[0.02]',
                  isOpen ? 'bg-mauve/[0.03]' : '',
                ].join(' ')}
              >
                <Chevron open={isOpen} />

                <span className={`text-xs font-bold tabular-nums ${rankColor}`}>
                  {rank}
                </span>

                <span className="font-mono text-sm text-ink truncate" title={m.model_name}>
                  {m.model_name}
                </span>

                <div className="text-right">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {Number(m.mean_survival_rounds).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-mauve/40 ml-1">rounds</span>
                </div>

                <span className="text-sm text-mauve/50 tabular-nums text-right">
                  {m.games_played}
                </span>

                <div className="flex justify-end">
                  <SurvivalBar pct={m.survival_rate_pct} />
                </div>
              </button>

              {isOpen && (
                <ModelDetailPanel
                  stats={
                    patternByModel === null
                      ? undefined
                      : patternByModel.get(m.model_name) ?? null
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
