export default function GameCircle({ players, myId, latestMessages, votes }) {
  const alive = players.filter((p) => p.isAlive);
  const dead = players.filter((p) => !p.isAlive);
  const total = alive.length;

  // Rotate so my avatar is always at the bottom
  const meIndex = alive.findIndex((p) => p.id === myId);
  const ordered = meIndex === -1 ? alive : [...alive.slice(meIndex), ...alive.slice(0, meIndex)];

  const radius = 190;
  const cx = 300;
  const cy = 260;

  return (
    <div style={{ position: 'relative', width: 600, height: 520, margin: '0 auto' }}>
      {ordered.map((player, i) => {
        const angle = ((270 + (i / total) * 360) * Math.PI) / 180;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const isMe = player.id === myId;
        const votesAgainst = Object.values(votes).filter((t) => t === player.id).length;

        return (
          <div
            key={player.id}
            style={{ position: 'absolute', left: x - 30, top: y - 30, textAlign: 'center', width: 60 }}
          >
            {/* Speech bubble */}
            {latestMessages[player.id] && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 72,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  zIndex: 10,
                }}
              >
                {latestMessages[player.id]}
              </div>
            )}

            {/* Avatar */}
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
            <div style={{ fontSize: 11, marginTop: 3, fontWeight: isMe ? 'bold' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {player.name}
            </div>

            {/* Vote count */}
            {votesAgainst > 0 && (
              <div style={{ fontSize: 10, color: '#ff4d4f', fontWeight: 'bold' }}>
                {votesAgainst} vote{votesAgainst > 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      })}

      {/* Eliminated players strip */}
      {dead.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '4px 0',
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
                {p.name} ({p.isAI !== undefined ? (p.isAI ? 'AI' : 'H') : '?'})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
