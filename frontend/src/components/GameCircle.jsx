import Avatar from './Avatar';

const RADIUS = 180;
const CX = 300;
const CY = 240;
const CONTAINER_W = 600;
const CONTAINER_H = 480;

export default function GameCircle({ players, myId, latestMessages, votes }) {
  const alive = players.filter((p) => p.isAlive);
  const dead = players.filter((p) => !p.isAlive);
  const total = alive.length;

  // Rotate array so my avatar is always first (placed at the bottom)
  const meIndex = alive.findIndex((p) => p.id === myId);
  const ordered = meIndex === -1 ? alive : [...alive.slice(meIndex), ...alive.slice(0, meIndex)];

  return (
    <div>
      {/* Circle arena */}
      <div style={{ position: 'relative', width: CONTAINER_W, height: CONTAINER_H, margin: '0 auto' }}>
        {ordered.map((player, i) => {
          // Start at 90° = bottom center (sin(90°)=1 in screen coords where y increases downward)
          const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
          const x = CX + RADIUS * Math.cos(angle);
          const y = CY + RADIUS * Math.sin(angle);
          const voteCount = Object.values(votes).filter((t) => t === player.id).length;

          return (
            <div key={player.id} style={{ position: 'absolute', left: x - 30, top: y - 30 }}>
              <Avatar
                player={player}
                latestMessage={latestMessages[player.id]}
                voteCount={voteCount}
                isMe={player.id === myId}
              />
            </div>
          );
        })}
      </div>

      {/* Eliminated players — outside the circle container to avoid overlap */}
      {dead.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '8px 0',
            borderTop: '1px solid #f0f0f0',
          }}
        >
          {dead.map((p) => (
            <div key={p.id} style={{ opacity: 0.4, textAlign: 'center' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  margin: '0 auto',
                }}
              >
                {p.name[0].toUpperCase()}
              </div>
              <div style={{ fontSize: 10 }}>
                {p.name} {p.isAI !== undefined ? `(${p.isAI ? 'AI' : 'H'})` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
