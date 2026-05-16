import { useState, useEffect } from 'react';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import socket from './socket';
import type { GameData, GameStartPayload, GameRejoinSuccessPayload } from '@hexa-hack/shared';

function setUrl(gameId: string, playerId: string): void {
  history.pushState(null, '', `?gameId=${gameId}&playerId=${playerId}`);
}

function clearUrl(): void {
  history.pushState(null, '', '/');
}

export default function App() {
  const [gameData, setGameData] = useState<GameData | null>(null);
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

      socket.once('game:rejoin:success', (data: GameRejoinSuccessPayload) => {
        setGameData(data);
        setLoading(false);
      });

      socket.once('game:rejoin:failed', () => {
        clearUrl();
        setLoading(false);
      });

      const timeout = setTimeout(() => {
        clearUrl();
        setLoading(false);
      }, 4_000);

      return () => clearTimeout(timeout);
    } else {
      setLoading(false);
    }
  }, []);

  function handleGameStart(data: GameStartPayload): void {
    setUrl(data.gameId, data.yourId);
    setGameData(data);
  }

  function handleLeave(): void {
    clearUrl();
    setGameData(null);
  }

  if (loading) return null;

  if (gameData) {
    return <Game gameData={gameData} onLeave={handleLeave} />;
  }
  return <Lobby onGameStart={handleGameStart} />;
}
