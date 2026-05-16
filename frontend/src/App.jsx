import { useState } from 'react';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

export default function App() {
  const [gameData, setGameData] = useState(null);

  if (gameData) {
    return <Game gameData={gameData} onLeave={() => setGameData(null)} />;
  }
  return <Lobby onGameStart={setGameData} />;
}
