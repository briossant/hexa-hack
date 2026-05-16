import Avatar from './Avatar';
import type { PublicPlayer, GameMessage } from '@hexa-hack/shared';

// All layout is expressed as % of the container or CSS relative units.
// Container has a fixed aspect-ratio so x% and y% map to a consistent visual circle.
const ASPECT = '5 / 4';
const ASPECT_RATIO = 5 / 4; // used to correct y% so the ring looks circular
const CX = 50;              // center x, % of container width
const CY = 50;              // center y, % of container height
const RADIUS_W = 32;        // radius as % of container width

interface GameCircleProps {
  players: PublicPlayer[];
  myId: string;
  latestMessages: Record<string, GameMessage>;
  votes: Record<string, string>;
}

export default function GameCircle({ players, myId, latestMessages, votes }: GameCircleProps) {
  const alive = players.filter((p) => p.isAlive);
  const dead  = players.filter((p) => !p.isAlive);
  const total = alive.length;

  const meIndex = alive.findIndex((p) => p.id === myId);
  const ordered = meIndex === -1 ? alive : [...alive.slice(meIndex), ...alive.slice(0, meIndex)];

  return (
    <div className="h-full flex flex-col">
      {/* Circle arena - fills available height, width follows aspect ratio */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div style={{ height: '100%', minHeight: '180px', aspectRatio: ASPECT, maxWidth: '100%', position: 'relative' }}>
          {ordered.map((player, i) => {
            const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
            const xPct = CX + RADIUS_W * Math.cos(angle);
            const yPct = CY + RADIUS_W * ASPECT_RATIO * Math.sin(angle);
            const voteCount = Object.values(votes).filter((t) => t === player.id).length;
            const msg = latestMessages[player.id];

            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Avatar
                  player={player}
                  latestMessage={msg?.text}
                  latestMessageId={msg?.id}
                  voteCount={voteCount}
                  isMe={player.id === myId}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Eliminated players */}
      {dead.length > 0 && (
        <div className="flex gap-3 justify-center flex-wrap py-2 border-t border-mauve/10 shrink-0">
          {dead.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 opacity-40">
              <img
                src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(p.avatarSeed)}`}
                alt={p.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-xs text-mauve">
                {p.name}
                {p.isAI !== undefined && (
                  <> &middot; {p.isAI ? (p.modelName ?? 'AI') : 'Human'}</>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
