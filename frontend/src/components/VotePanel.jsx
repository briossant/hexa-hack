import { useState } from 'react';

export default function VotePanel({ players, votes, myId, onVote, phase }) {
  const [selected, setSelected] = useState(null);
  const hasVoted = myId in votes;
  const label = phase === 'mayor_vote' ? 'Vote for Mayor' : 'Vote to Eliminate';

  return (
    <div style={{ marginTop: 16, border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{label}</h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {players.map((p) => {
          const voteCount = Object.values(votes).filter((t) => t === p.id).length;
          const isMyVote = votes[myId] === p.id;
          const isSelected = selected === p.id;

          return (
            <button
              key={p.id}
              onClick={() => !hasVoted && setSelected(p.id === selected ? null : p.id)}
              disabled={hasVoted}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: `2px solid ${isMyVote ? '#ff4d4f' : isSelected ? '#1890ff' : '#d9d9d9'}`,
                background: isMyVote ? '#fff1f0' : isSelected ? '#e6f7ff' : 'white',
                cursor: hasVoted ? 'default' : 'pointer',
                fontSize: 13,
              }}
            >
              {p.name}
              {voteCount > 0 && (
                <span style={{ marginLeft: 6, color: '#ff4d4f', fontWeight: 'bold' }}>
                  {voteCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!hasVoted ? (
        <button
          onClick={() => { if (selected) { onVote(selected); } }}
          disabled={!selected}
          style={{
            padding: '8px 20px',
            background: selected ? '#1890ff' : '#f5f5f5',
            color: selected ? 'white' : '#bbb',
            border: 'none',
            borderRadius: 4,
            cursor: selected ? 'pointer' : 'not-allowed',
            fontSize: 14,
          }}
        >
          Confirm Vote
        </button>
      ) : (
        <p style={{ color: '#52c41a', margin: 0, fontSize: 13 }}>Vote cast. Waiting for others...</p>
      )}
    </div>
  );
}
