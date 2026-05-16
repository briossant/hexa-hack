import Avatar from './Avatar';
import type { PublicPlayer, GameMessage, GamePhase } from '@hexa-hack/shared';

// Container aspect ratio 5:4
const ASPECT = '5 / 4';
const ASPECT_RATIO = 5 / 4;
const CX = 50;
const CY = 50;
const RADIUS_W = 32;

// SVG uses viewBox "0 0 100 80" so units are square on a 5:4 container.
// x SVG = xPct, y SVG = yPct * 0.8
const toSvg = (xPct: number, yPct: number) => ({ x: xPct, y: yPct * 0.8 });

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

  // Build position map for SVG arrows
  const posMap: Record<string, { x: number; y: number }> = {};
  ordered.forEach((player, i) => {
    const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
    const xPct = CX + RADIUS_W * Math.cos(angle);
    const yPct = CY + RADIUS_W * ASPECT_RATIO * Math.sin(angle);
    posMap[player.id] = toSvg(xPct, yPct);
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div style={{ height: '100%', minHeight: '180px', aspectRatio: ASPECT, maxWidth: '100%', position: 'relative' }}>

          {/* Ring path + vote arrows */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
            viewBox="0 0 100 80"
            preserveAspectRatio="none"
          >
            {/* Subtle ring the avatars sit on — circle is r=32 at (50,40) in square SVG units */}
            <circle cx="50" cy="40" r="32" fill="none" stroke="#6d435a" strokeOpacity="0.12" strokeWidth="0.6" />
            <defs>
              <marker id="arrow-me" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#ff6978" />
              </marker>
              <marker id="arrow-other" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#6d435a60" />
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
              const avatarR = 5; // approx avatar radius in SVG units
              const x1 = from.x + nx * avatarR;
              const y1 = from.y + ny * avatarR;
              const x2 = to.x - nx * (avatarR + 3);
              const y2 = to.y - ny * (avatarR + 3);
              const isMe = voterId === myId;
              return (
                <line
                  key={voterId}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isMe ? '#ff6978' : '#6d435a50'}
                  strokeWidth={isMe ? '1' : '0.7'}
                  markerEnd={isMe ? 'url(#arrow-me)' : 'url(#arrow-other)'}
                />
              );
            })}
          </svg>

          {/* Player avatars */}
          {ordered.map((player, i) => {
            const angle = ((90 + (i / total) * 360) * Math.PI) / 180;
            const xPct = CX + RADIUS_W * Math.cos(angle);
            const yPct = CY + RADIUS_W * ASPECT_RATIO * Math.sin(angle);
            const voteCount = Object.values(votes).filter((t) => t === player.id).length;
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
                  voteCount={voteCount}
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
  );
}
