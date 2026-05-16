import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import GameCircle from '../components/GameCircle';
import Timer from '../components/Timer';
import ChatPanel from '../components/ChatPanel';
import Alert from '../components/Alert';
import type {
  GameData,
  PublicPlayer,
  GameMessage,
  EliminatedPlayer,
  GameAnalysisResponse,
} from '@hexa-hack/shared';

interface GameProps {
  gameData: GameData;
  onLeave: () => void;
}

interface AlertState {
  title: string;
  body: string;
  accent: 'coral' | 'sage' | 'mauve';
  duration?: number;
}

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: GameAnalysisResponse }
  | { status: 'error'; message: string };

export default function Game({ gameData, onLeave }: GameProps) {
  const { gameId, yourId: myId } = gameData;
  const [players, setPlayers] = useState<PublicPlayer[]>(gameData.players);
  const [phase, setPhase] = useState(gameData.phase);
  const [round, setRound] = useState(gameData.round);
  const [messages, setMessages] = useState<GameMessage[]>(gameData.messages ?? []);
  const [votes, setVotes] = useState<Record<string, string>>(gameData.votes ?? {});
  const [timeLeft, setTimeLeft] = useState(0);
  const [input, setInput] = useState('');
  const [winner, setWinner] = useState<'humans' | 'ai' | null>(null);
  const [isBreak, setIsBreak] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (gameData.phaseEndsAt) {
      startTimer(gameData.phaseEndsAt - Date.now());
    }

    socket.on('phase:change', ({ phase, phaseEndsAt, round }) => {
      setPhase(phase);
      setVotes({});
      setRound(round);
      setIsBreak(false);
      setAlert(null);
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
      setIsBreak(true);
      if (timerRef.current) clearInterval(timerRef.current);
      if (playerId && playerName) {
        setAlert({ title: 'Mayor elected', body: `${playerName} is the new Mayor and will break ties.`, accent: 'mauve', duration: 5000 });
      } else {
        setAlert({ title: 'No mayor', body: 'The vote was tied — no mayor was elected this round.', accent: 'mauve', duration: 5000 });
      }
    });

    socket.on('round:end', ({ eliminated }) => {
      setIsBreak(true);
      if (timerRef.current) clearInterval(timerRef.current);
      if (eliminated) {
        setPlayers((prev) => prev.map((p) => applyElimination(p, eliminated)));
        const identity = eliminated.isAI
          ? `AI · ${eliminated.modelName ?? 'unknown model'}`
          : 'Human';
        const nameReveal = eliminated.realName ? ` (${eliminated.realName})` : '';
        setAlert({
          title: `${eliminated.name}${nameReveal} eliminated`,
          body: `They were a ${identity}.`,
          accent: eliminated.isAI ? 'sage' : 'coral',
          duration: 5000,
        });
      } else {
        setAlert({ title: 'Tied vote', body: 'No one was eliminated this round.', accent: 'mauve', duration: 5000 });
      }
    });

    socket.on('game:over', async ({ winner, players }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayers(players);
      setWinner(winner);
      setPhase('ended');
      setIsBreak(true);
      setAlert({
        title: winner === 'humans' ? 'Humans win!' : 'AIs win!',
        body: winner === 'humans'
          ? 'All AI players have been eliminated.'
          : 'The AIs now equal or outnumber the humans.',
        accent: winner === 'humans' ? 'sage' : 'coral',
      });

      setAnalysis({ status: 'loading' });
      try {
        const res = await fetch(`/analyzer/analyze/${gameId}`, { method: 'POST' });
        if (!res.ok) throw new Error(`analyzer responded ${res.status}`);
        const data: GameAnalysisResponse = await res.json();
        setAnalysis({ status: 'success', data });
      } catch (err) {
        setAnalysis({ status: 'error', message: (err as Error).message });
      }
    });

    return () => {
      socket.off('phase:change');
      socket.off('game:message');
      socket.off('vote:cast');
      socket.off('mayor:elected');
      socket.off('round:end');
      socket.off('game:over');
    };
  }, []);

  function applyElimination(p: PublicPlayer, eliminated: EliminatedPlayer): PublicPlayer {
    if (p.id !== eliminated.id) return p;
    return {
      ...p,
      isAlive: false,
      isAI: eliminated.isAI,
      modelName: eliminated.modelName,
      realName: eliminated.realName,
    };
  }

  function startTimer(remainingMs: number): void {
    if (timerRef.current) clearInterval(timerRef.current);
    const end = Date.now() + Math.max(0, remainingMs);
    setTimeLeft(Math.ceil(Math.max(0, remainingMs) / 1000));
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && timerRef.current) clearInterval(timerRef.current);
    }, 500);
  }

  function sendMessage(): void {
    if (!input.trim()) return;
    socket.emit('game:message', { gameId, text: input.trim() });
    setInput('');
  }

  function castVote(targetId: string): void {
    socket.emit('game:vote', { gameId, targetId });
  }

  const latestMessages: Record<string, GameMessage> = {};
  for (const m of messages) latestMessages[m.playerId] = m;

  const phaseBadge: Record<string, string> = {
    mayor_vote: 'bg-mauve/10 text-mauve',
    vote: 'bg-coral/10 text-coral',
  };

  return (
    <div className="h-screen bg-shell flex flex-col overflow-hidden">
      {alert && (
        <Alert
          title={alert.title}
          body={alert.body}
          accent={alert.accent}
          duration={alert.duration}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="flex-1 min-h-0 w-full mx-auto px-3 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-col max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink text-sm sm:text-base">Round {round}</span>
            {phase && phase !== 'ended' && !isBreak && (
              <span className={`text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium capitalize ${phaseBadge[phase] ?? 'bg-mauve/10 text-mauve'}`}>
                {phase.replace('_', ' ')}
              </span>
            )}
            {isBreak && !winner && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-mauve/10 text-mauve">
                Break
              </span>
            )}
            {winner && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${winner === 'humans' ? 'bg-sage/15 text-sage' : 'bg-coral/10 text-coral'}`}>
                {winner === 'humans' ? 'Humans win!' : 'AIs win!'}
              </span>
            )}
          </div>
          {!winner && !isBreak && (
            <div className="flex items-center gap-3">
              {(phase === 'vote' || phase === 'mayor_vote') && (
                <span className="text-xs text-mauve/70 hidden sm:block">
                  {votes[myId]
                    ? 'Waiting for others…'
                    : phase === 'mayor_vote'
                    ? 'Click a player to vote for Mayor'
                    : 'Click a player to eliminate'}
                </span>
              )}
              <Timer seconds={timeLeft} />
            </div>
          )}
        </div>

        {/* Main content: circle (left/top) + chat (right/bottom) */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
          {/* Circle area or winner summary */}
          <div className="flex-1 min-h-0 overflow-auto">
            {winner ? (
              <div className="h-full flex items-start justify-center pt-6 px-2">
                <div className="w-full max-w-sm">
                  <h2 className={`text-3xl font-bold mb-1 ${winner === 'humans' ? 'text-sage' : 'text-coral'}`}>
                    {winner === 'humans' ? 'Humans win!' : 'AIs win!'}
                  </h2>
                  <p className="text-mauve text-sm mb-6">
                    Game lasted {round} round{round !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-col gap-1 mb-6">
                    {players.map((p) => (
                      <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-mauve/10 last:border-0">
                        <span className="text-ink text-sm">
                          {p.name}
                          {p.realName && <span className="text-mauve/60 text-xs ml-1">({p.realName})</span>}
                          {p.id === myId && <span className="text-mauve text-xs ml-1">(you)</span>}
                        </span>
                        <span className={`text-xs font-medium ${p.isAI ? 'text-coral' : 'text-sage'}`}>
                          {p.isAI ? `AI · ${p.modelName ?? 'unknown'}` : 'Human'}{!p.isAlive ? ' · out' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-ink mb-2">Why were they caught?</h3>
                    {analysis.status === 'loading' && (
                      <p className="text-mauve text-xs">Analyzing game logs…</p>
                    )}
                    {analysis.status === 'error' && (
                      <p className="text-coral text-xs">Analysis failed: {analysis.message}</p>
                    )}
                    {analysis.status === 'success' && analysis.data.exposed_bots_count === 0 && (
                      <p className="text-mauve text-xs">No bots were exposed in this game.</p>
                    )}
                    {analysis.status === 'success' && analysis.data.forensic_reports.map(({ player_name, model_name, report }) => (
                      <div key={player_name} className="mb-3 p-3 rounded-lg bg-mauve/5">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-medium text-ink">{player_name}</span>
                          <span className="text-xs text-mauve">{model_name ?? 'unknown'} · {report.severity}</span>
                        </div>
                        <p className="text-xs text-mauve/80 mb-2 italic">{report.verdict}</p>
                        {report.sections.map((s) => (
                          <div key={s.label} className="mb-2 last:mb-0">
                            <p className="text-xs font-medium text-ink">{s.headline}</p>
                            {s.evidence.map((e, i) => (
                              <p key={i} className="text-xs text-mauve/70 pl-2">
                                r{e.round}: <span className="italic">"{e.quote}"</span>
                              </p>
                            ))}
                          </div>
                        ))}
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
            ) : (
              <GameCircle
                players={players}
                myId={myId}
                latestMessages={latestMessages}
                votes={votes}
                phase={phase}
                onVote={castVote}
              />
            )}
          </div>

          {/* Chat panel */}
          <ChatPanel
            messages={messages}
            players={players}
            myId={myId}
            phase={phase}
            isBreak={isBreak}
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
          />
        </div>
      </div>
    </div>
  );
}
