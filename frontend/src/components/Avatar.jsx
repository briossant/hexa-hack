import DialogBubble from './DialogBubble';

export default function Avatar({ player, latestMessage, voteCount, isMe }) {
  return (
    <div className="relative text-center w-14">
      <DialogBubble text={latestMessage} />

      <div
        className={[
          'w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all',
          isMe
            ? 'bg-coral text-white border-coral'
            : 'bg-white text-ink border-mauve/20',
          player.isMayor ? 'border-yellow-400 border-2' : '',
        ].join(' ')}
      >
        {player.isMayor ? '👑' : player.name[0].toUpperCase()}
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
