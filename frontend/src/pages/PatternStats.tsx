import { useEffect, useState } from 'react';
import type { PatternStatsResponse, PatternStat } from '@hexa-hack/shared';

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-8 py-4 animate-pulse">
      <div className="flex-1 h-3 rounded bg-mauve/10" />
      <div className="w-32 h-1 rounded-full bg-mauve/10" />
      <div className="w-10 h-3 rounded bg-mauve/10" />
    </div>
  );
}

function PatternRow({ pattern, max }: { pattern: PatternStat; max: number }) {
  const widthPct = max > 0 ? Math.max(2, (pattern.bots_affected / max) * 100) : 0;
  return (
    <div
      className="grid grid-cols-[1fr_180px_70px] gap-x-6 items-center px-10 py-4 border-t border-mauve/8 hover:bg-mauve/[0.02] transition-colors"
      title={pattern.description}
    >
      <span className="text-sm text-ink truncate">{pattern.headline}</span>
      <div className="w-full h-1 rounded-full bg-mauve/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-coral transition-all duration-700"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="text-right text-xs text-mauve/60 tabular-nums">
        <span className="font-semibold text-ink">{pattern.bots_affected}</span> bot
        {pattern.bots_affected !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default function PatternStats() {
  const [stats, setStats] = useState<PatternStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/analyzer/stats/patterns')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then((data: PatternStatsResponse) => {
        setStats(data);
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
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-mauve/50 text-sm py-12">
        Could not load pattern analysis.
      </p>
    );
  }

  if (!stats || stats.total_bots_analyzed === 0) {
    return (
      <div className="text-center py-14 px-8">
        <p className="text-ink font-medium text-sm">No bots analyzed yet.</p>
        <p className="text-mauve/50 text-xs mt-2">
          Catch a few AIs to see the patterns that gave them away.
        </p>
      </div>
    );
  }

  if (stats.patterns.length === 0) {
    return (
      <div className="text-center py-12 px-8">
        <p className="text-ink font-medium text-sm">No patterns surfaced.</p>
        <p className="text-mauve/50 text-xs mt-2">
          {stats.total_bots_analyzed} bot{stats.total_bots_analyzed !== 1 ? 's' : ''}{' '}
          analyzed across {stats.total_games_analyzed} game
          {stats.total_games_analyzed !== 1 ? 's' : ''}, but the detector found nothing
          conclusive.
        </p>
      </div>
    );
  }

  const max = stats.patterns[0]?.bots_affected ?? 0;

  return ;
  return (
    <div className="flex flex-col">
      <div className="px-10 pt-6 pb-3 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-mauve/50 font-semibold">
          Why bots get caught
        </p>
        <p className="text-xs text-mauve/50 tabular-nums">
          {stats.total_bots_analyzed} bot{stats.total_bots_analyzed !== 1 ? 's' : ''}
          {' · '}
          {stats.total_games_analyzed} game{stats.total_games_analyzed !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex flex-col">
        {stats.patterns.map((p) => (
          <PatternRow key={p.label} pattern={p} max={max} />
        ))}
      </div>
    </div>
  );
}
