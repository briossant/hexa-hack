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

  const meIndex = alive.findIndex((p) => p.id === myId);
  const ordered = meIndex === -1 ? alive : [...alive.slice(meIndex), ...alive.slice(0, meIndex)];

  return (
    <div>
      {/* Circle arena */}
      <div style={{ position: 'relative', width: CONTAINER_W, height: CONTAINER_H, margin: '0 auto' }}>
        {ordered.map((player, i) => {
          const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
          const x = CX + RADIUS * Math.cos(angle);
          const y = CY + RADIUS * Math.sin(angle);
          const voteCount = Object.values(votes).filter((t) => t === player.id).length;

          return (
            <div key={player.id} style={{ position: 'absolute', left: x - 28, top: y - 28 }}>
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

      {/* Eliminated players */}
      {dead.length > 0 && (
        <div className="flex gap-3 justify-center flex-wrap py-3 border-t border-mauve/10">
          {dead.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 opacity-40">
              <div className="w-6 h-6 rounded-full bg-mauve/10 flex items-center justify-center text-xs font-bold text-mauve">
                {p.name[0].toUpperCase()}
              </div>
              <span className="text-xs text-mauve">
                {p.name}{p.isAI !== undefined ? ` · ${p.isAI ? 'AI' : 'Human'}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
