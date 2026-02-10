import { useEffect, useState } from 'react';
import Menu from './components/Menu';
import GameCanvas from './components/GameCanvas';

function App() {
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAME_OVER
  const [gameSettings, setGameSettings] = useState(null);
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('language') || 'en';
    } catch {
      return 'en';
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {
      return 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      return;
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch {
      return;
    }
  }, [language]);

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
      {gameState === 'MENU' && (
        <Menu
          onStart={startGame}
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
      {gameState === 'PLAYING' && (
        <GameCanvas settings={gameSettings} onEnd={endGame} language={language} theme={theme} />
      )}
    </div>
  );
}

export default App;
