import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import GameCircle from '../components/GameCircle';
import VotePanel from '../components/VotePanel';
import Timer from '../components/Timer';

export default function Game({ gameData, onLeave }) {
  const { gameId, yourId: myId } = gameData;
  const [players, setPlayers] = useState(gameData.players);
  const [phase, setPhase] = useState(gameData.phase || null);
  const [round, setRound] = useState(gameData.round || 0);
  const [messages, setMessages] = useState(gameData.messages || []);
  const [votes, setVotes] = useState(gameData.votes || {});
  const [timeLeft, setTimeLeft] = useState(0);
  const [input, setInput] = useState('');
  const [winner, setWinner] = useState(null);
  const [notification, setNotification] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Initialise timer from the phase already in progress (game:start or rejoin snapshot).
    if (gameData.phaseEndsAt) {
      startTimer(gameData.phaseEndsAt - Date.now());
    }

    socket.on('phase:change', ({ phase, phaseEndsAt, round }) => {
      setPhase(phase);
      setVotes({});
      if (round !== undefined) setRound(round);
      startTimer(phaseEndsAt - Date.now());
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
          prev.map((p) =>
            p.id === eliminated.id
              ? { ...p, isAlive: false, isAI: eliminated.isAI, modelName: eliminated.modelName }
              : p
          )
        );
        const reveal = eliminated.isAI ? `AI · ${eliminated.modelName ?? 'unknown model'}` : 'Human';
        notify(`${eliminated.name} eliminated — ${reveal}`);
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

  function startTimer(remainingMs) {
    clearInterval(timerRef.current);
    const end = Date.now() + Math.max(0, remainingMs);
    setTimeLeft(Math.ceil(Math.max(0, remainingMs) / 1000));
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

  const phaseBadge = {
    mayor_vote: 'bg-mauve/10 text-mauve',
    discussion: 'bg-sage/15 text-sage',
    vote: 'bg-coral/10 text-coral',
  }[phase] ?? 'bg-mauve/10 text-mauve';

  if (winner) {
    return (
      <div className="min-h-screen bg-shell flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className={`text-4xl font-bold mb-1 ${winner === 'humans' ? 'text-sage' : 'text-coral'}`}>
            {winner === 'humans' ? 'Humans win!' : 'AIs win!'}
          </h1>
          <p className="text-mauve text-sm mb-8">
            Game lasted {round} round{round !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-col gap-1 mb-8">
            {players.map((p) => (
              <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-mauve/10 last:border-0">
                <span className="text-ink text-sm">
                  {p.name} {p.id === myId && <span className="text-mauve text-xs">(you)</span>}
                </span>
                <span className={`text-xs font-medium ${p.isAI ? 'text-coral' : 'text-sage'}`}>
                  {p.isAI ? `AI · ${p.modelName ?? 'unknown'}` : 'Human'}{!p.isAlive ? ' · out' : ''}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onLeave}
            className="w-full bg-ink text-shell rounded-xl py-3 font-medium hover:bg-ink/90 transition"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-shell flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 w-full mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-col max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink text-sm sm:text-base">Round {round}</span>
            {phase && (
              <span className={`text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium capitalize ${phaseBadge}`}>
                {phase.replace('_', ' ')}
              </span>
            )}
          </div>
          <Timer seconds={timeLeft} />
        </div>

        {/* Notification banner */}
        {notification && (
          <div className="bg-white border border-mauve/15 text-ink px-3 py-2 rounded-xl text-xs sm:text-sm mb-3 shadow-sm">
            {notification}
          </div>
        )}

        {/* Game circle */}
        <div className="flex-1 min-h-0">
          <GameCircle players={players} myId={myId} latestMessages={latestMessages} votes={votes} />
        </div>

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
          <div className="flex gap-2 mt-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Say something..."
              maxLength={300}
              className="flex-1 border border-mauve/25 rounded-xl px-3 sm:px-4 py-2.5 text-ink bg-white focus:outline-none focus:border-mauve/60 transition text-sm placeholder:text-mauve/40"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-4 sm:px-5 py-2.5 bg-ink text-shell text-sm font-medium rounded-xl hover:bg-ink/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
