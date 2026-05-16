export default function Timer({ seconds }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const urgent = seconds <= 10 && seconds > 0;

  return (
    <span style={{ fontSize: 22, fontWeight: 'bold', color: urgent ? '#ff4d4f' : '#222', fontVariantNumeric: 'tabular-nums' }}>
      {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
    </span>
  );
}
