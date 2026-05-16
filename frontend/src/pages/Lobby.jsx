import { useState, useEffect } from 'react';
import socket from '../socket';

export default function Lobby({ onGameStart }) {
  const [status, setStatus] = useState('idle');
  const [position, setPosition] = useState(0);

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
    socket.emit('queue:join');
    setStatus('queued');
  };

  return (
    <div className="min-h-screen bg-shell flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold text-ink mb-1 tracking-tight">Hunt the Bot</h1>
        <p className="text-mauve text-sm mb-10">
          Find the AIs among the players before they outnumber you.
        </p>

        {status === 'idle' ? (
          <div className="flex flex-col gap-3">
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
      </div>
    </div>
  );
}
