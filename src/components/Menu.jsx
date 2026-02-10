import { useState } from 'react';

const DIFFICULTY_OPTIONS = [
    { value: 'superEasy', label: 'Super Easy' },
    { value: 'easy', label: 'Easy' },
    { value: 'normal', label: 'Normal' },
    { value: 'hard', label: 'Hard' },
];

const PLAYER_COLORS = {
    p1: { label: 'P1', css: 'p1' },
    p2: { label: 'P2', css: 'p2' },
    p3: { label: 'P3', css: 'p3' },
    p4: { label: 'P4', css: 'p4' },
};

const SIDES_2 = { p1: 'Left', p2: 'Right' };
const SIDES_3 = { p1: 'Left', p2: 'Right', p3: 'Bottom' };
const SIDES_4 = { p1: 'Left', p2: 'Right', p3: 'Bottom', p4: 'Top' };

const KEYS_MAP = {
    p1: 'A / Z',
    p2: '↑ / ↓',
    p3: 'C / V',
    p4: 'N / M',
};

const defaultPlayer = (id, name, isCPU = false) => ({
    id,
    name,
    isCPU,
    difficulty: 'easy',
    lives: 1,
});

const Menu = ({ onStart }) => {
    const [playerCount, setPlayerCount] = useState(2);
    const [players, setPlayers] = useState([
        defaultPlayer('p1', 'Player 1', false),
        defaultPlayer('p2', 'CPU', true),
        defaultPlayer('p3', 'Player 3', false),
        defaultPlayer('p4', 'Player 4', false),
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
                name: !wasCPU ? 'CPU' : `Player ${index + 1}`,
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
        });
    };

    const handleCountChange = (count) => {
        setPlayerCount(count);
    };

    // Check at least one human player
    const hasHuman = players.slice(0, playerCount).some(p => !p.isCPU);

    return (
        <div className="menu-container">
            {/* Title */}
            <h1 className="menu-title">VIBEPONG</h1>
            <div className="menu-subtitle">Multiplayer Neon Pong</div>
            <div className="menu-divider" />

            {/* Player count */}
            <div className="menu-section">
                <div className="menu-section-title">Players</div>
                <div className="player-count-selector">
                    {[2, 3, 4].map(n => (
                        <button
                            key={n}
                            type="button"
                            className={`player-count-btn ${playerCount === n ? 'active' : ''}`}
                            onClick={() => handleCountChange(n)}
                        >
                            {n} SLOTS
                        </button>
                    ))}
                </div>
            </div>

            {/* Player cards */}
            <div className="menu-section">
                <div className="menu-section-title">Configure</div>
                {players.slice(0, playerCount).map((player, index) => {
                    const pid = activePlayerIds[index];
                    const side = sidesMap[pid];
                    return (
                        <div className="player-card" key={pid}>
                            <div className={`player-badge ${PLAYER_COLORS[pid].css}`}>
                                {PLAYER_COLORS[pid].label}
                            </div>
                            <div className="player-card-fields">
                                <input
                                    type="text"
                                    placeholder={`Player ${index + 1}`}
                                    value={player.name}
                                    onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                                    style={{ opacity: player.isCPU ? 0.5 : 1 }}
                                />

                                {/* CPU toggle */}
                                <div
                                    className={`cpu-toggle ${player.isCPU ? 'enabled' : ''}`}
                                    onClick={() => toggleCPU(index)}
                                    title="Toggle CPU control"
                                >
                                    <span className="cpu-toggle-label">CPU</span>
                                    <div className="cpu-toggle-switch" />
                                </div>

                                {/* CPU difficulty */}
                                {player.isCPU && (
                                    <div className="difficulty-selector">
                                        {DIFFICULTY_OPTIONS.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                className={`difficulty-btn ${player.difficulty === d.value ? 'active' : ''}`}
                                                onClick={() => updatePlayer(index, 'difficulty', d.value)}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Lives */}
                                <div className="lives-adjuster" title="Lives">
                                    <button type="button" onClick={() => adjustLives(index, -1)}>−</button>
                                    <span className="lives-count">♥{player.lives}</span>
                                    <button type="button" onClick={() => adjustLives(index, 1)}>+</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Validation warning */}
            {!hasHuman && (
                <div style={{
                    color: '#ff8800',
                    fontSize: '0.85em',
                    marginBottom: '0.5em',
                    fontStyle: 'italic'
                }}>
                    ⚠ All players are CPU — you'll be watching AI vs AI!
                </div>
            )}

            {/* Start button */}
            <button className="start-button" onClick={handleStart}>
                <span>START GAME</span>
            </button>
        </div>
    );
};

export default Menu;
