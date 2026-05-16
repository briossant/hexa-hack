import { useState, useEffect } from 'react';
import socket from '../socket';

export default function Lobby({ onGameStart }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | queued
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
    if (!name.trim()) return;
    socket.emit('queue:join', { name: name.trim() });
    setStatus('queued');
  };

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: '80px auto' }}>
      <h1 style={{ marginBottom: 4 }}>Hunt the Bot</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Find the AIs among the players before they outnumber you.
      </p>

      {status === 'idle' ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinQueue()}
            placeholder="Your name"
            maxLength={20}
            style={{ display: 'block', width: '100%', padding: 10, marginBottom: 10, boxSizing: 'border-box', fontSize: 16 }}
          />
          <button
            onClick={joinQueue}
            disabled={!name.trim()}
            style={{ width: '100%', padding: 10, fontSize: 16, cursor: 'pointer' }}
          >
            Join Queue
          </button>
        </>
      ) : (
        <div>
          <p>Waiting for players... <strong>{position}</strong> in queue</p>
          <p style={{ color: '#888', fontSize: 13 }}>Game starts when enough players join, or after 30 seconds.</p>
        </div>
      )}
    </div>
  );
}
