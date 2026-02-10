import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, CANVAS_WIDTH, CANVAS_HEIGHT, SQUARE_SIZE } from '../utils/gameLogic';
import { exportToCSV } from '../utils/csvExport';
import { getText } from '../utils/i18n';

const PLAYER_COLORS_HEX = {
    p1: '#00f3ff',
    p2: '#ff00ff',
    p3: '#00ff00',
    p4: '#ffff00',
};

const KEYS_MAP = {
    p1: 'A / Z',
    p2: '↑ / ↓',
    p3: 'C / V',
    p4: 'N / M',
};

const GameCanvas = ({ settings, onEnd, language, theme }) => {
    const t = useCallback((key, vars) => getText(language, key, vars), [language]);
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const frameIdRef = useRef(null);
    const [gameOverStats, setGameOverStats] = useState(null);
    const [playerStates, setPlayerStates] = useState({});
    // Track active visual effects for life loss
    const lifeLostOverlaysRef = useRef([]);
    const inputRef = useRef({
        p1: { up: false, down: false },
        p2: { up: false, down: false },
        p3: { left: false, right: false },
        p4: { left: false, right: false }
    });
    const lastProcessedGameId = useRef(null);

    // Helper to start/restart game
    const startGame = useCallback(() => {
        setGameOverStats(null);
        setPlayerStates({});
        lifeLostOverlaysRef.current = [];

        const canvas = canvasRef.current;
        const isSquare = settings.mode === '3P' || settings.mode === '4P';
        canvas.width = isSquare ? SQUARE_SIZE : CANVAS_WIDTH;
        canvas.height = isSquare ? SQUARE_SIZE : CANVAS_HEIGHT;

        const handleGameOver = (stats) => {
            if (lastProcessedGameId.current === stats.gameId) return;
            lastProcessedGameId.current = stats.gameId;

            cancelAnimationFrame(frameIdRef.current);
            setGameOverStats(stats);
            try {
                exportToCSV(stats);
            } catch (e) {
                console.error("CSV Export failed:", e);
            }
        };

        gameRef.current = new GameEngine(settings, handleGameOver);

        let frameCount = 0;
        const render = () => {
            const game = gameRef.current;
            if (!game) return;

            game.update(inputRef.current);
            const ctx = canvas.getContext('2d');
            const now = performance.now();

            const isLight = theme === 'light';
            const backgroundColor = isLight ? '#ffffff' : '#050505';
            const ballColor = isLight ? '#ff7a00' : '#ffffff';

            // Draw Background
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // ── Life Lost Effects: consume from engine queue ──
            while (game.lifeLostEffects.length > 0) {
                const effect = game.lifeLostEffects.shift();
                lifeLostOverlaysRef.current.push({
                    ...effect,
                    startTime: now,
                    duration: 1200, // ms
                });
            }

            // ── Draw life-lost screen flash + text ──
            lifeLostOverlaysRef.current = lifeLostOverlaysRef.current.filter(eff => {
                const elapsed = now - eff.startTime;
                if (elapsed > eff.duration) return false;

                const progress = elapsed / eff.duration;
                const color = PLAYER_COLORS_HEX[eff.playerId] || '#ff0000';

                // Red/color tinted overlay flash — fades out
                const flashAlpha = Math.max(0, 0.35 * (1 - progress));
                ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha * 0.5})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Edge glow on the side that lost
                ctx.save();
                const glowAlpha = Math.max(0, 0.8 * (1 - progress));
                const gradient = ctx.createLinearGradient(
                    eff.side === 'right' ? canvas.width : 0,
                    eff.side === 'bottom' ? canvas.height : 0,
                    eff.side === 'right' ? canvas.width - 120 : (eff.side === 'left' ? 120 : 0),
                    eff.side === 'bottom' ? canvas.height - 120 : (eff.side === 'top' ? 120 : 0)
                );
                gradient.addColorStop(0, `rgba(255, 50, 50, ${glowAlpha})`);
                gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();

                // Floating text: "−1 ♥" with player name
                if (progress < 0.8) {
                    const textAlpha = Math.max(0, 1 - progress / 0.8);
                    const yOffset = progress * 40;
                    ctx.save();
                    ctx.globalAlpha = textAlpha;
                    ctx.font = 'bold 42px Orbitron, Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#ff3333';
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#ff0000';
                    ctx.fillText('−1 ♥', canvas.width / 2, canvas.height / 2 - 15 - yOffset);

                    ctx.font = 'bold 20px Inter, sans-serif';
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    const lifeUnit = eff.remainingLives === 1 ? t('life') : t('lives');
                    const lifeText = eff.remainingLives <= 0
                        ? t('eliminated', { name: eff.playerName })
                        : t('livesRemaining', { name: eff.playerName, count: eff.remainingLives, unit: lifeUnit });
                    ctx.fillText(lifeText, canvas.width / 2, canvas.height / 2 + 25 - yOffset);
                    ctx.restore();
                }

                return true;
            });

            // Draw Paddles
            Object.values(game.players).forEach(p => {
                const color = PLAYER_COLORS_HEX[p.id] || '#fff';
                if (p.active) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = color;
                    ctx.fillStyle = color;
                    ctx.fillRect(p.x, p.y, p.width, p.height);
                }
                ctx.shadowBlur = 0;
            });

            // Draw Ball
            if (!game.winner) {
                const b = game.ball;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = ballColor;
                ctx.shadowBlur = 10;
                ctx.shadowColor = ballColor;
                ctx.fill();
                ctx.closePath();
            }

            // Draw Countdown
            if (game.countdown !== null && game.countdown >= 0) {
                const isLight = theme === 'light';
                ctx.fillStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = isLight ? '#222' : '#fff';
                ctx.font = '100px Orbitron, Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00f3ff';
                ctx.fillText(Math.ceil(game.countdown) === 0 ? t('go') : Math.ceil(game.countdown), canvas.width / 2, canvas.height / 2);

                // Show keys for each human player during countdown
                Object.values(game.players).forEach(p => {
                    if (p.active && !p.isAI) {
                        ctx.save();
                        const color = PLAYER_COLORS_HEX[p.id] || '#fff';
                        ctx.fillStyle = color;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = color;
                        ctx.font = 'bold 24px Orbitron, sans-serif';
                        ctx.textAlign = 'center';

                        let tx = p.x + p.width / 2;
                        let ty = p.y + p.height / 2;

                        if (p.side === 'left') tx = p.x + 60;
                        if (p.side === 'right') tx = p.x - 60;
                        if (p.side === 'top') ty = p.y + 60;
                        if (p.side === 'bottom') ty = p.y - 60;

                        ctx.fillText(KEYS_MAP[p.id], tx, ty);
                        ctx.font = '12px Inter, sans-serif';
                        ctx.fillText(t('keys'), tx, ty + 25);
                        ctx.restore();
                    }
                });
            }

            // Draw Game Over
            if (game.winner) {
                const isLight = theme === 'light';
                ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.85)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ff00ff';
                ctx.fillStyle = isLight ? '#222' : '#fff';
                ctx.font = 'bold 72px Orbitron, Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(t('gameOver'), canvas.width / 2, canvas.height / 2 - 60);

                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00f3ff';
                ctx.font = 'bold 36px Inter, sans-serif';
                ctx.fillText(t('winner', { name: game.winner }), canvas.width / 2, canvas.height / 2 + 10);

                ctx.shadowBlur = 0;
                ctx.fillStyle = isLight ? '#666' : '#888';
                ctx.font = '16px Inter, sans-serif';
                ctx.fillText(t('gameSaved'), canvas.width / 2, canvas.height / 2 + 60);

                return;
            }

            // Update player states for the info bar (every ~10 frames)
            frameCount++;
            if (frameCount % 10 === 0) {
                const states = {};
                Object.values(game.players).forEach(p => {
                    states[p.id] = { name: p.name, lives: p.lives, active: p.active, isAI: p.isAI, difficulty: p.difficulty, side: p.side };
                });
                setPlayerStates(states);
            }

            frameIdRef.current = requestAnimationFrame(render);
        };

        // Initial state
        const initStates = {};
        Object.values(gameRef.current.players).forEach(p => {
            initStates[p.id] = { name: p.name, lives: p.lives, active: p.active, isAI: p.isAI, difficulty: p.difficulty, side: p.side };
        });
        setPlayerStates(initStates);

        render();
    }, [settings, t, theme]);

    useEffect(() => {
        startGame();
        return () => cancelAnimationFrame(frameIdRef.current);
    }, [startGame]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a') inputRef.current.p1.up = true;
            if (key === 'z') inputRef.current.p1.down = true;
            if (e.key === 'ArrowUp') { e.preventDefault(); inputRef.current.p2.up = true; }
            if (e.key === 'ArrowDown') { e.preventDefault(); inputRef.current.p2.down = true; }
            if (key === 'c') inputRef.current.p3.left = true;
            if (key === 'v') inputRef.current.p3.right = true;
            if (key === 'n') inputRef.current.p4.left = true;
            if (key === 'm') inputRef.current.p4.right = true;
        };

        const handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a') inputRef.current.p1.up = false;
            if (key === 'z') inputRef.current.p1.down = false;
            if (e.key === 'ArrowUp') inputRef.current.p2.up = false;
            if (e.key === 'ArrowDown') inputRef.current.p2.down = false;
            if (key === 'c') inputRef.current.p3.left = false;
            if (key === 'v') inputRef.current.p3.right = false;
            if (key === 'n') inputRef.current.p4.left = false;
            if (key === 'm') inputRef.current.p4.right = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const activePlayerIds = Object.keys(playerStates);

    return (
        <div className="game-wrapper">
            <div style={{ position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
                        borderBottom: 'none',
                        borderRadius: '16px 16px 0 0',
                        maxWidth: '95vw',
                        maxHeight: '80vh',
                        display: 'block'
                    }}
                />
                {gameOverStats && (
                    <div style={{
                        position: 'absolute',
                        top: '75%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        zIndex: 10
                    }}>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button onClick={startGame} style={{
                                fontSize: '1.2em',
                                padding: '0.8em 2em',
                                cursor: 'pointer',
                                color: '#00f3ff',
                                border: '2px solid #00f3ff',
                                backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)',
                                boxShadow: '0 0 15px #00f3ff',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s',
                                fontFamily: 'Orbitron, Inter, sans-serif'
                            }}>{t('restart')}</button>

                            <button onClick={onEnd} style={{
                                fontSize: '1.2em',
                                padding: '0.8em 2em',
                                cursor: 'pointer',
                                color: '#ff00ff',
                                border: '2px solid #ff00ff',
                                backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)',
                                boxShadow: '0 0 15px #ff00ff',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s',
                                fontFamily: 'Orbitron, Inter, sans-serif'
                            }}>{t('menu')}</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Player Info Bar Below Canvas */}
            <div className="player-info-bar">
                {activePlayerIds.map(pid => {
                    const p = playerStates[pid];
                    if (!p) return null;
                    const color = PLAYER_COLORS_HEX[pid];
                    const sideLabel = t(`side_${p.side}`);
                    return (
                        <div
                            key={pid}
                            className={`player-info-item ${!p.active ? 'eliminated' : ''}`}
                        >
                            <div className="player-info-color" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                            <div className="player-info-details">
                                <div className="player-info-name" style={{ color: p.active ? color : '#555' }}>
                                    {p.name}
                                    <span className="player-info-side">{sideLabel}</span>
                                </div>
                                <div className="player-info-meta">
                                    <span className="player-info-lives">
                                        {'♥'.repeat(Math.max(0, p.lives))}
                                        {p.lives <= 0 && '✗'}
                                    </span>
                                    {p.isAI ? (
                                        <span className="player-info-cpu-badge">
                                            {t('cpu')} · {t(`difficultyShort_${p.difficulty}`) || p.difficulty}
                                        </span>
                                    ) : (
                                        <span className="player-info-keys-box">
                                            <kbd>{KEYS_MAP[pid].split(' / ')[0]}</kbd>
                                            <span className="key-sep">/</span>
                                            <kbd>{KEYS_MAP[pid].split(' / ')[1]}</kbd>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GameCanvas;
