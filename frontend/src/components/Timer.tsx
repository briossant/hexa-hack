interface TimerProps {
  seconds: number;
}

export default function Timer({ seconds }: TimerProps) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const urgent = seconds <= 10 && seconds > 0;

  return (
    <span className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${urgent ? 'text-coral' : 'text-ink'}`}>
      {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
    </span>
  );
}
