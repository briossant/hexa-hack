export default function DialogBubble({ text }) {
  if (!text) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 11,
        whiteSpace: 'nowrap',
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}
