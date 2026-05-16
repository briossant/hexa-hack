import DialogBubble from './DialogBubble';

// Avatar size scales with viewport: min 2.5rem, target 9vw, max 3.5rem
const AVATAR_SIZE = 'clamp(2.5rem, 9vw, 3.5rem)';

export default function Avatar({ player, latestMessage, voteCount, isMe }) {
  return (
    <div className="relative text-center" style={{ width: AVATAR_SIZE }}>
      <DialogBubble text={latestMessage} />

      <div
        className={[
          'relative rounded-full overflow-hidden border-2 transition-all',
          isMe ? 'border-coral' : 'border-mauve/20',
          player.isMayor ? 'border-yellow-400' : '',
        ].join(' ')}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        <img
          src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(player.avatarSeed ?? player.name)}`}
          alt={player.name}
          className="w-full h-full object-cover"
        />
        {player.isMayor && (
          <div className="absolute -top-1 -right-1 text-sm leading-none">👑</div>
        )}
      </div>

      <div className={`text-xs mt-1 truncate ${isMe ? 'font-semibold text-ink' : 'text-mauve'}`}>
        {player.name}
      </div>

      {voteCount > 0 && (
        <div className="text-xs font-bold text-coral">
          {voteCount}×
        </div>
      )}
    </div>
  );
}
