import { useState } from 'react';
import { getText } from '../utils/i18n';

const DIFFICULTY_OPTIONS = ['superEasy', 'easy', 'normal', 'hard'];

const PLAYER_COLORS = {
    p1: { label: 'P1', css: 'p1' },
    p2: { label: 'P2', css: 'p2' },
    p3: { label: 'P3', css: 'p3' },
    p4: { label: 'P4', css: 'p4' },
};

const SIDES_2 = { p1: 'Left', p2: 'Right' };
const SIDES_3 = { p1: 'Left', p2: 'Right', p3: 'Bottom' };
const SIDES_4 = { p1: 'Left', p2: 'Right', p3: 'Bottom', p4: 'Top' };

const defaultPlayer = (id, name, isCPU = false) => ({
    id,
    name,
    isCPU,
    difficulty: 'easy',
    lives: 1,
});

const Menu = ({ onStart, language, onLanguageChange, theme, onThemeChange }) => {
    const t = (key, vars) => getText(language, key, vars);
    const [playerCount, setPlayerCount] = useState(2);
    const [players, setPlayers] = useState(() => [
        defaultPlayer('p1', getText(language, 'playerPlaceholder', { index: 1 }), false),
        defaultPlayer('p2', getText(language, 'cpu'), true),
        defaultPlayer('p3', getText(language, 'playerPlaceholder', { index: 3 }), false),
        defaultPlayer('p4', getText(language, 'playerPlaceholder', { index: 4 }), false),
    ]);

    const sidesMap = playerCount === 2 ? SIDES_2 : playerCount === 3 ? SIDES_3 : SIDES_4;
    const activePlayerIds = Object.keys(sidesMap);

    const updatePlayer = (index, field, value) => {
        setPlayers(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const toggleCPU = (index) => {
        setPlayers(prev => {
            const next = [...prev];
            const wasCPU = next[index].isCPU;
            next[index] = {
                ...next[index],
                isCPU: !wasCPU,
                name: !wasCPU ? t('cpu') : t('playerPlaceholder', { index: index + 1 }),
            };
            return next;
        });
    };

    const adjustLives = (index, delta) => {
        setPlayers(prev => {
            const next = [...prev];
            const newLives = Math.max(1, Math.min(99, next[index].lives + delta));
            next[index] = { ...next[index], lives: newLives };
            return next;
        });
    };

    const handleStart = () => {
        const mode = `${playerCount}P`;

        // Build players map and determine if any CPU exists
        const playersMap = {};
        const cpuSettings = {};
        const livesMap = {};
        activePlayerIds.forEach((pid, i) => {
            playersMap[pid] = players[i].name;
            if (players[i].isCPU) {
                cpuSettings[pid] = players[i].difficulty;
            }
            livesMap[pid] = players[i].lives;
        });

        onStart({
            mode,
            players: playersMap,
            cpuSettings,     // { p2: 'easy', p3: 'hard', ... }
            livesMap,         // { p1: 3, p2: 5, ... }
            theme,
            language,
        });
    };

    const handleCountChange = (count) => {
        setPlayerCount(count);
    };

    // Check at least one human player
    const hasHuman = players.slice(0, playerCount).some(p => !p.isCPU);

    return (
        <div className="menu-container">
            <div className="menu-top-actions">
                <div className="menu-toggle-group">
                    <button
                        type="button"
                        className={`menu-toggle-btn ${language === 'en' ? 'active' : ''}`}
                        onClick={() => onLanguageChange('en')}
                    >
                        English
                    </button>
                    <button
                        type="button"
                        className={`menu-toggle-btn ${language === 'zh' ? 'active' : ''}`}
                        onClick={() => onLanguageChange('zh')}
                    >
                        中文
                    </button>
                </div>
                <button
                    type="button"
                    className="menu-theme-toggle"
                    onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                >
                    <span className="menu-theme-label">{theme === 'dark' ? t('dark') : t('light')}</span>
                    <span className={`menu-theme-switch ${theme}`} />
                </button>
            </div>
            <h1 className="menu-title">VIBEPONG</h1>
            <div className="menu-subtitle">{t('menuSubtitle')}</div>
            <div className="menu-divider" />

            <div className="menu-section">
                <div className="menu-section-title">{t('playersTitle')}</div>
                <div className="player-count-selector">
                    {[2, 3, 4].map(n => (
                        <button
                            key={n}
                            type="button"
                            className={`player-count-btn ${playerCount === n ? 'active' : ''}`}
                            onClick={() => handleCountChange(n)}
                        >
                            {n} {t('slots')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="menu-section">
                <div className="menu-section-title">{t('configureTitle')}</div>
                {players.slice(0, playerCount).map((player, index) => {
                    const pid = activePlayerIds[index];
                    return (
                        <div className="player-card" key={pid}>
                            <div className={`player-badge ${PLAYER_COLORS[pid].css}`}>
                                {PLAYER_COLORS[pid].label}
                            </div>
                            <div className="player-card-fields">
                                <input
                                    type="text"
                                    placeholder={t('playerPlaceholder', { index: index + 1 })}
                                    value={player.name}
                                    onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                                    style={{ opacity: player.isCPU ? 0.5 : 1 }}
                                />

                                <div
                                    className={`cpu-toggle ${player.isCPU ? 'enabled' : ''}`}
                                    onClick={() => toggleCPU(index)}
                                    title={t('cpuToggleTitle')}
                                >
                                    <span className="cpu-toggle-label">{t('cpu')}</span>
                                    <div className="cpu-toggle-switch" />
                                </div>

                                {player.isCPU && (
                                    <div className="difficulty-selector">
                                        {DIFFICULTY_OPTIONS.map(value => (
                                            <button
                                                key={value}
                                                type="button"
                                                className={`difficulty-btn ${player.difficulty === value ? 'active' : ''}`}
                                                onClick={() => updatePlayer(index, 'difficulty', value)}
                                            >
                                                {t(`difficulty_${value}`)}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="lives-adjuster" title={t('livesLabel')}>
                                    <button type="button" onClick={() => adjustLives(index, -1)}>−</button>
                                    <span className="lives-count">♥{player.lives}</span>
                                    <button type="button" onClick={() => adjustLives(index, 1)}>+</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {!hasHuman && (
                <div style={{
                    color: '#ff8800',
                    fontSize: '0.85em',
                    marginBottom: '0.5em',
                    fontStyle: 'italic'
                }}>
                    {t('warningAllCpu')}
                </div>
            )}

            <button className="start-button" onClick={handleStart}>
                <span>{t('startGame')}</span>
            </button>
        </div>
    );
};

export default Menu;
