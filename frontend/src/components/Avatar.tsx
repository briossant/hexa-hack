import DialogBubble from './DialogBubble';
import type { PublicPlayer } from '@hexa-hack/shared';

const AVATAR_SIZE = 'clamp(2.5rem, min(8vw, 10vh), 5rem)';

interface AvatarProps {
  player: PublicPlayer;
  latestMessage?: string;
  latestMessageId?: string;
  isMe: boolean;
  isVoteable?: boolean;
  isMyVoteTarget?: boolean;
  onClick?: () => void;
}

export default function Avatar({
  player,
  latestMessage,
  latestMessageId,
  isMe,
  isVoteable,
  isMyVoteTarget,
  onClick,
}: AvatarProps) {
  const isDead = !player.isAlive;

  const borderClass = isMyVoteTarget
    ? 'border-coral ring-2 ring-coral/40 ring-offset-1'
    : isMe
    ? 'border-coral'
    : player.isMayor && !isDead
    ? 'border-yellow-400'
    : isVoteable
    ? 'border-mauve/30 hover:border-coral/60'
    : 'border-mauve/20';

  return (
    <div
      className={`relative text-center select-none ${isVoteable ? 'cursor-pointer' : ''}`}
      style={{ width: AVATAR_SIZE }}
      onClick={onClick}
    >
      {!isDead && <DialogBubble key={latestMessageId} text={latestMessage} />}

      {/* Crown above avatar — outside overflow-hidden so it isn't clipped */}
      <div className="relative inline-block">
        {player.isMayor && !isDead && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-base leading-none z-10 select-none">
            👑
          </div>
        )}
        <div
          className={`rounded-full overflow-hidden border-2 transition-all ${borderClass}`}
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            filter: isDead ? 'grayscale(1)' : undefined,
            opacity: isDead ? 0.5 : 1,
          }}
        >
          <img
            src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(player.avatarSeed)}`}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className={`text-xs mt-1 truncate ${isMe ? 'font-semibold text-ink' : isDead ? 'text-mauve/40' : 'text-mauve'}`}>
        {player.name}
      </div>

      {isDead && player.isAI !== undefined && (
        <div className="text-xs text-mauve/50 leading-tight mt-0.5">
          {player.isAI ? `AI · ${player.modelName ?? 'bot'}` : 'Human'}
          {player.realName && <div className="truncate">{player.realName}</div>}
        </div>
      )}

    </div>
  );
}
