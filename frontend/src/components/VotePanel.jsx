import { useState } from 'react';

export default function VotePanel({ players, votes, myId, onVote, phase }) {
  const [selected, setSelected] = useState(null);
  const hasVoted = myId in votes;
  const label = phase === 'mayor_vote' ? 'Vote for Mayor' : 'Vote to Eliminate';

  return (
    <div className="mt-4 bg-white border border-mauve/15 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink mb-3">{label}</h3>

      <div className="flex flex-wrap gap-2 mb-4">
        {players.map((p) => {
          const voteCount = Object.values(votes).filter((t) => t === p.id).length;
          const isMyVote = votes[myId] === p.id;
          const isSelected = selected === p.id;

          return (
            <button
              key={p.id}
              onClick={() => !hasVoted && setSelected(p.id === selected ? null : p.id)}
              disabled={hasVoted}
              className={[
                'px-4 py-1.5 rounded-full text-sm border transition',
                isMyVote
                  ? 'border-coral bg-coral/5 text-coral font-medium'
                  : isSelected
                  ? 'border-coral text-ink'
                  : 'border-mauve/20 text-ink hover:border-mauve/50',
                hasVoted ? 'cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              {p.name}
              {voteCount > 0 && (
                <span className="ml-1.5 font-bold text-coral">{voteCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {!hasVoted ? (
        <button
          onClick={() => selected && onVote(selected)}
          disabled={!selected}
          className="px-5 py-2 bg-coral text-white text-sm font-medium rounded-xl transition hover:bg-coral/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm Vote
        </button>
      ) : (
        <p className="text-sm text-sage font-medium">Vote cast — waiting for others...</p>
      )}
    </div>
  );
}
