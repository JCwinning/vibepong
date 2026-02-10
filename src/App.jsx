import { useState } from 'react';
import Menu from './components/Menu';
import GameCanvas from './components/GameCanvas';

function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAME_OVER
  const [gameSettings, setGameSettings] = useState(null);

  const startGame = (settings) => {
    setGameSettings(settings);
    setGameState('PLAYING');
  };

  const endGame = () => {
    setGameState('MENU');
    setGameSettings(null);
  };

  return (
    <div className="game-container">
      {gameState === 'MENU' && <Menu onStart={startGame} />}
      {gameState === 'PLAYING' && (
        <GameCanvas settings={gameSettings} onEnd={endGame} />
      )}
    </div>
  );
}

export default App;
