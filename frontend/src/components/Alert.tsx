import { useEffect } from 'react';

interface AlertProps {
  title: string;
  body: string;
  accent?: 'coral' | 'sage' | 'mauve';
  onClose: () => void;
  /** Auto-close after this many ms (default: never). */
  duration?: number;
}

export default function Alert({ title, body, accent = 'mauve', onClose, duration }: AlertProps) {
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const borderColor = {
    coral: 'border-coral',
    sage: 'border-sage',
    mauve: 'border-mauve',
  }[accent];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
      <div className={`bg-white rounded-2xl shadow-2xl border-2 ${borderColor} w-full max-w-sm pointer-events-auto overflow-hidden`}>
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-ink text-lg leading-tight">{title}</h3>
            <button
              onClick={onClose}
              className="shrink-0 mt-0.5 text-mauve/50 hover:text-ink transition text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-mauve leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
