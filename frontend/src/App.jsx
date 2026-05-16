import { useState, useEffect } from 'react';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import socket from './socket';

function setUrl(gameId, playerId) {
  history.pushState(null, '', `?gameId=${gameId}&playerId=${playerId}`);
}

function clearUrl() {
  history.pushState(null, '', '/');
}

export default function App() {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('gameId');
    const playerId = params.get('playerId');

    if (gameId && playerId) {
      socket.connect();

      const tryRejoin = () => socket.emit('game:rejoin', { gameId, playerId });

      if (socket.connected) tryRejoin();
      else socket.once('connect', tryRejoin);

      socket.once('game:rejoin:success', (data) => {
        setGameData(data);
        setLoading(false);
      });

      socket.once('game:rejoin:failed', () => {
        clearUrl();
        setLoading(false);
      });

      // Fallback: give up after 4s and show lobby
      const timeout = setTimeout(() => {
        clearUrl();
        setLoading(false);
      }, 4000);

      return () => clearTimeout(timeout);
    } else {
      setLoading(false);
    }
  }, []);

  function handleGameStart(data) {
    setUrl(data.gameId, data.yourId);
    setGameData(data);
  }

  function handleLeave() {
    clearUrl();
    setGameData(null);
  }

  if (loading) return null;

  if (gameData) {
    return <Game gameData={gameData} onLeave={handleLeave} />;
  }
  return <Lobby onGameStart={handleGameStart} />;
}
