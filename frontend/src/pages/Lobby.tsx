import { useState, useEffect } from 'react';
import socket from '../socket';
import Leaderboard from './Leaderboard';
import type { GameStartPayload } from '@hexa-hack/shared';

interface LobbyProps {
  onGameStart: (data: GameStartPayload) => void;
}

type Tab = 'play' | 'rankings';

export default function Lobby({ onGameStart }: LobbyProps) {
  const [tab, setTab] = useState<Tab>('play');
  const [status, setStatus] = useState<'idle' | 'queued'>('idle');
  const [position, setPosition] = useState(0);
  const [realName, setRealName] = useState('');

  useEffect(() => {
    socket.connect();

    socket.on('queue:joined', ({ position }) => {
      setStatus('queued');
      setPosition(position);
    });

    socket.on('game:start', (data) => {
      onGameStart(data);
    });

    return () => {
      socket.off('queue:joined');
      socket.off('game:start');
    };
  }, [onGameStart]);

  const joinQueue = () => {
    socket.emit('queue:join', { realName: realName.trim() || undefined });
    setStatus('queued');
  };

  return (
    <div className="min-h-screen bg-shell flex items-center justify-center px-4">
      <div className={`w-full transition-all duration-300 ${tab === 'rankings' ? 'max-w-2xl' : 'max-w-lg'}`}>
        <h1 className="text-5xl sm:text-6xl font-bold text-ink mb-2 tracking-tight">Hunt the Bot</h1>
        <p className="text-mauve text-base mb-8">
          Find the AIs among the players before they outnumber you.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-mauve/8 rounded-xl w-fit">
          {(['play', 'rankings'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-5 py-1.5 rounded-lg text-sm font-medium transition-all',
                tab === t
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-mauve/60 hover:text-mauve',
              ].join(' ')}
            >
              {t === 'play' ? 'Play' : 'Rankings'}
            </button>
          ))}
        </div>

        {tab === 'play' ? (
          <>
            {status === 'idle' ? (
              <div className="flex flex-col gap-3">
                <input
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinQueue()}
                  placeholder="Your real name (revealed when eliminated)"
                  maxLength={40}
                  className="w-full border border-mauve/25 rounded-xl px-4 py-3 text-ink bg-white focus:outline-none focus:border-mauve/60 transition placeholder:text-mauve/40"
                />
                <button
                  onClick={joinQueue}
                  className="w-full bg-coral text-white rounded-xl py-3 font-medium hover:bg-coral/90 transition"
                >
                  Join Queue
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-sage animate-pulse" />
                  <span className="text-ink font-medium">
                    Waiting for players&nbsp;&mdash;&nbsp;<strong>{position}</strong> in queue
                  </span>
                </div>
                <p className="text-mauve/60 text-xs">
                  Game starts when enough players join, or after 30 seconds.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="border border-mauve/15 rounded-2xl bg-white overflow-hidden">
            <Leaderboard />
          </div>
        )}
      </div>
    </div>
  );
}
