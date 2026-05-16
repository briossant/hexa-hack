export default function DialogBubble({ text }) {
  if (!text) return null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-mauve/15 rounded-lg px-2.5 py-1 text-xs text-ink whitespace-nowrap max-w-36 overflow-hidden text-ellipsis shadow-sm z-10 pointer-events-none">
      {text}
    </div>
  );
}
