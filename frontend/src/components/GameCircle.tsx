import Avatar from './Avatar';
import type { PublicPlayer, GameMessage, GamePhase } from '@hexa-hack/shared';

// Square container — x% and y% use the same scale so the ring is a true circle.
const CX = 50;
const CY = 50;
const RADIUS = 36; // % of container size

interface GameCircleProps {
  players: PublicPlayer[];
  myId: string;
  latestMessages: Record<string, GameMessage>;
  votes: Record<string, string>;
  phase: GamePhase;
  onVote?: (targetId: string) => void;
}

export default function GameCircle({ players, myId, latestMessages, votes, phase, onVote }: GameCircleProps) {
  const total = players.length;

  const meIndex = players.findIndex((p) => p.id === myId);
  const ordered = meIndex === -1 ? players : [...players.slice(meIndex), ...players.slice(0, meIndex)];

  const isVotePhase = phase === 'vote' || phase === 'mayor_vote';
  const myVoteTarget = votes[myId];
  const hasVoted = myVoteTarget !== undefined;

  // Player positions as % of the square container (= SVG units directly)
  const posMap: Record<string, { x: number; y: number }> = {};
  ordered.forEach((player, i) => {
    const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
    posMap[player.id] = {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {/* Square container — enforced by both dimensions being 100% of the smaller axis */}
        <div style={{ width: '100%', height: '100%', maxWidth: '100%', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(100%, 100vh)',
            aspectRatio: '1',
          }}>

            {/* Ring + vote arrows */}
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* The ring avatars sit on */}
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#6d435a" strokeOpacity="0.12" strokeWidth="0.5" />

              <defs>
                <marker id="arrow-me" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L0,5 L5,2.5 z" fill="#ff6978" />
                </marker>
                <marker id="arrow-other" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0,0 L0,5 L5,2.5 z" fill="#a08898" />
                </marker>
              </defs>

              {Object.entries(votes).map(([voterId, targetId]) => {
                const from = posMap[voterId];
                const to = posMap[targetId];
                if (!from || !to) return null;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len < 0.01) return null;
                const nx = dx / len;
                const ny = dy / len;
                const avatarR = 5;
                const isMe = voterId === myId;
                // Offset control point perpendicular to the line so back-to-back arrows don't overlap
                const curveOffset = 6;
                const x1 = from.x + nx * avatarR;
                const y1 = from.y + ny * avatarR;
                const x2 = to.x - nx * (avatarR + 3);
                const y2 = to.y - ny * (avatarR + 3);
                const mx = (x1 + x2) / 2 - ny * curveOffset;
                const my = (y1 + y2) / 2 + nx * curveOffset;
                return (
                  <path
                    key={voterId}
                    d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                    fill="none"
                    stroke={isMe ? '#ff6978' : '#a08898'}
                    strokeWidth={isMe ? '0.6' : '0.4'}
                    markerEnd={isMe ? 'url(#arrow-me)' : 'url(#arrow-other)'}
                  />
                );
              })}
            </svg>

            {/* Player avatars */}
            {ordered.map((player, i) => {
              const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
              const xPct = CX + RADIUS * Math.cos(angle);
              const yPct = CY + RADIUS * Math.sin(angle);
              const msg = latestMessages[player.id];
              const isVoteable = isVotePhase && player.isAlive && player.id !== myId && !hasVoted;
              const isMyVoteTarget = myVoteTarget === player.id;

              return (
                <div
                  key={player.id}
                  style={{
                    position: 'absolute',
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                  }}
                >
                  <Avatar
                    player={player}
                    latestMessage={msg?.text}
                    latestMessageId={msg?.id}
                    isMe={player.id === myId}
                    isVoteable={isVoteable}
                    isMyVoteTarget={isMyVoteTarget}
                    onClick={isVoteable ? () => onVote?.(player.id) : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
