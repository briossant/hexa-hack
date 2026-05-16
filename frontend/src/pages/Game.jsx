import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import GameCircle from '../components/GameCircle';
import VotePanel from '../components/VotePanel';
import Timer from '../components/Timer';

export default function Game({ gameData, onLeave }) {
  const { gameId, yourId: myId } = gameData;
  const [players, setPlayers] = useState(gameData.players);
  const [phase, setPhase] = useState(null);
  const [round, setRound] = useState(0);
  const [messages, setMessages] = useState([]);
  const [votes, setVotes] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [input, setInput] = useState('');
  const [winner, setWinner] = useState(null);
  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    socket.on('phase:change', ({ phase, duration, round }) => {
      setPhase(phase);
      setVotes({});
      if (round !== undefined) setRound(round);
      startTimer(duration);
    });

    socket.on('game:message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('vote:cast', ({ voterId, targetId }) => {
      setVotes((prev) => ({ ...prev, [voterId]: targetId }));
    });

    socket.on('mayor:elected', ({ playerId, playerName }) => {
      setPlayers((prev) => prev.map((p) => ({ ...p, isMayor: p.id === playerId })));
      notify(`${playerName} is the mayor`);
    });

    socket.on('round:end', ({ eliminated, round }) => {
      if (eliminated) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === eliminated.id ? { ...p, isAlive: false, isAI: eliminated.isAI } : p))
        );
        notify(`${eliminated.name} eliminated — they were ${eliminated.isAI ? 'an AI' : 'a human'}!`);
      } else {
        notify('No elimination this round (tied vote)');
      }
    });

    socket.on('game:over', ({ winner, players }) => {
      clearInterval(timerRef.current);
      setPlayers(players);
      setWinner(winner);
    });

    return () => {
      ['phase:change', 'game:message', 'vote:cast', 'mayor:elected', 'round:end', 'game:over'].forEach(
        (e) => socket.off(e)
      );
    };
  }, []);

  function startTimer(duration) {
    clearInterval(timerRef.current);
    const end = Date.now() + duration;
    setTimeLeft(Math.ceil(duration / 1000));
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(timerRef.current);
    }, 500);
  }

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }

  function sendMessage() {
    if (!input.trim()) return;
    socket.emit('game:message', { gameId, text: input.trim() });
    setInput('');
  }

  function castVote(targetId) {
    socket.emit('game:vote', { gameId, targetId });
  }

  // Latest message per player (for speech bubbles)
  const latestMessages = {};
  messages.forEach((m) => { latestMessages[m.playerId] = m.text; });

  if (winner) {
    return (
      <div style={{ padding: 40, maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
        <h1>{winner === 'humans' ? 'Humans win!' : 'AIs win!'}</h1>
        <p style={{ color: '#666' }}>Game lasted {round} round{round !== 1 ? 's' : ''}</p>
        <div style={{ margin: '24px 0', textAlign: 'left' }}>
          {players.map((p) => (
            <div key={p.id} style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.name} {p.id === myId ? '(you)' : ''}</span>
              <span style={{ color: p.isAI ? '#ff4d4f' : '#52c41a' }}>
                {p.isAI ? 'AI' : 'Human'} {!p.isAlive ? '— eliminated' : ''}
              </span>
            </div>
          ))}
        </div>
        <button onClick={onLeave} style={{ padding: '10px 28px', fontSize: 15, cursor: 'pointer' }}>
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <strong>Round {round}</strong>
          <span style={{ marginLeft: 12, color: '#888', textTransform: 'capitalize' }}>
            {phase?.replace('_', ' ')}
          </span>
        </div>
        <Timer seconds={timeLeft} />
      </div>

      {/* Notification banner */}
      {notification && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '8px 14px', borderRadius: 6, marginBottom: 12 }}>
          {notification}
        </div>
      )}

      {/* Game circle */}
      <GameCircle players={players} myId={myId} latestMessages={latestMessages} votes={votes} />

      {/* Vote panel */}
      {(phase === 'vote' || phase === 'mayor_vote') && (
        <VotePanel
          players={players.filter((p) => p.isAlive && p.id !== myId)}
          votes={votes}
          myId={myId}
          onVote={castVote}
          phase={phase}
        />
      )}

      {/* Chat input */}
      {phase === 'discussion' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something..."
            maxLength={300}
            style={{ flex: 1, padding: 10, fontSize: 14 }}
          />
          <button onClick={sendMessage} disabled={!input.trim()} style={{ padding: '10px 16px', cursor: 'pointer' }}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
