import DialogBubble from './DialogBubble';

export default function Avatar({ player, latestMessage, voteCount, isMe }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', width: 60 }}>
      <DialogBubble text={latestMessage} />

      {/* Circle */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: isMe ? '#1890ff' : '#f5f5f5',
          border: `3px solid ${player.isMayor ? 'gold' : isMe ? '#096dd9' : '#d9d9d9'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          color: isMe ? 'white' : '#333',
          fontWeight: 'bold',
        }}
      >
        {player.isMayor ? '👑' : player.name[0].toUpperCase()}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 11,
          marginTop: 3,
          fontWeight: isMe ? 'bold' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {player.name}
      </div>

      {/* Vote count */}
      {voteCount > 0 && (
        <div style={{ fontSize: 10, color: '#ff4d4f', fontWeight: 'bold' }}>
          {voteCount} vote{voteCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
