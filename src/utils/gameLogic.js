
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const PADDLE_WIDTH = 10;
export const PADDLE_HEIGHT = 100;
export const BALL_RADIUS = 8;
export const INITIAL_SPEED = 6.5;
export const SQUARE_SIZE = 700;

export class GameEngine {
    constructor(settings, onGameOver) {
        this.settings = settings; // { mode, players, cpuSettings, livesMap }
        this.onGameOver = onGameOver;
        this.mode = settings.mode;
        this.width = (this.mode === '3P' || this.mode === '4P') ? SQUARE_SIZE : CANVAS_WIDTH;
        this.height = (this.mode === '3P' || this.mode === '4P') ? SQUARE_SIZE : CANVAS_HEIGHT;

        // cpuSettings: { p2: 'easy', p3: 'hard', ... } — only CPU players
        // livesMap: { p1: 3, p2: 5, ... }
        const cpuSettings = settings.cpuSettings || {};
        const livesMap = settings.livesMap || {};
        const defaultLives = settings.initialLives || 1;

        // Life lost effects queue (consumed by renderer)
        this.lifeLostEffects = [];

        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            vx: 0,
            vy: 0,
            speed: INITIAL_SPEED,
            lastHitBy: null
        };

        this.players = {
            p1: {
                id: 'p1', name: settings.players.p1,
                x: 20, y: this.height / 2 - PADDLE_HEIGHT / 2,
                width: PADDLE_WIDTH, height: PADDLE_HEIGHT,
                score: 0, lives: livesMap.p1 ?? defaultLives, active: true, hits: 0,
                type: 'vertical', side: 'left',
                isAI: !!cpuSettings.p1,
                difficulty: cpuSettings.p1 || null
            },
            p2: {
                id: 'p2', name: settings.players.p2,
                x: this.width - 30, y: this.height / 2 - PADDLE_HEIGHT / 2,
                width: PADDLE_WIDTH, height: PADDLE_HEIGHT,
                score: 0, lives: livesMap.p2 ?? defaultLives, active: true, hits: 0,
                type: 'vertical', side: 'right',
                isAI: !!cpuSettings.p2,
                difficulty: cpuSettings.p2 || null
            },
        };

        if (this.mode === '3P' || this.mode === '4P') {
            this.players.p1.y = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;
            this.players.p2.x = SQUARE_SIZE - 30;
            this.players.p2.y = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;

            this.players.p3 = {
                id: 'p3', name: settings.players.p3,
                x: SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2, y: SQUARE_SIZE - 30,
                width: PADDLE_HEIGHT, height: PADDLE_WIDTH,
                score: 0, lives: livesMap.p3 ?? defaultLives, active: true, hits: 0,
                type: 'horizontal', side: 'bottom',
                isAI: !!cpuSettings.p3,
                difficulty: cpuSettings.p3 || null
            };
        }

        if (this.mode === '4P') {
            this.players.p4 = {
                id: 'p4', name: settings.players.p4,
                x: SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2, y: 20,
                width: PADDLE_HEIGHT, height: PADDLE_WIDTH,
                score: 0, lives: livesMap.p4 ?? defaultLives, active: true, hits: 0,
                type: 'horizontal', side: 'top',
                isAI: !!cpuSettings.p4,
                difficulty: cpuSettings.p4 || null
            };
        }

        this.startTime = Date.now();
        this.gameId = `G${this.startTime}-${Math.floor(Math.random() * 1000)}`;
        this.winner = null;
        this.actionLog = [];
        this.countdown = 3;
        this.isPaused = true;

        // Start Countdown
        this.startCountdown();
    }

    startCountdown() {
        const interval = setInterval(() => {
            this.countdown--;
            if (this.countdown < 0) {
                clearInterval(interval);
                this.isPaused = false;
                this.countdown = null;
                this.resetBall();
            }
        }, 1000);
    }

    logAction(playerId, action) {
        const playerName = playerId === 'system' ? 'System' : (this.players[playerId]?.name || playerId);
        this.actionLog.push({
            timestamp: Date.now() - this.startTime,
            player: playerName,
            action: action
        });
    }

    update(input) {
        if (this.winner || this.isPaused) return;

        // Speed Increase (1% per second approx, called 60 times/sec)
        this.ball.speed *= 1.00016;

        this.handleInput(input);
        this.updateBall();
        this.checkWinCondition();
    }

    handleInput(input) {
        const speed = 7;

        const movePlayer = (p, axis, dir, bound, size) => {
            if (dir === -1) p[axis] = Math.max(0, p[axis] - speed);
            if (dir === 1) p[axis] = Math.min(bound - size, p[axis] + speed);
        };

        // Handle each player: AI or human input
        Object.values(this.players).forEach(p => {
            if (!p.active) return;

            if (p.isAI) {
                this.updateAI(p);
            } else {
                const inp = input[p.id];
                if (!inp) return;
                if (p.type === 'vertical') {
                    if (inp.up) movePlayer(p, 'y', -1, this.height, p.height);
                    if (inp.down) movePlayer(p, 'y', 1, this.height, p.height);
                } else {
                    if (inp.left) movePlayer(p, 'x', -1, this.width, p.width);
                    if (inp.right) movePlayer(p, 'x', 1, this.width, p.width);
                }
            }
        });
    }

    updateAI(player) {
        const difficulty = player.difficulty || 'normal';

        let errorMargin = 0;
        let aiSpeed = 5;
        let reactionDeadzone = 10;

        switch (difficulty) {
            case 'superEasy':
                errorMargin = 80;
                aiSpeed = 2.5;
                reactionDeadzone = 30;
                break;
            case 'easy':
                errorMargin = 40;
                aiSpeed = 4;
                reactionDeadzone = 15;
                break;
            case 'normal':
                errorMargin = 20;
                aiSpeed = 5;
                reactionDeadzone = 10;
                break;
            case 'hard':
                errorMargin = 5;
                aiSpeed = 6.5;
                reactionDeadzone = 3;
                break;
        }

        if (player.type === 'vertical') {
            const center = player.y + player.height / 2;
            let target = this.ball.y + (Math.random() - 0.5) * errorMargin;

            if (center < target - reactionDeadzone) player.y += aiSpeed;
            else if (center > target + reactionDeadzone) player.y -= aiSpeed;

            player.y = Math.max(0, Math.min(this.height - player.height, player.y));
        } else {
            const center = player.x + player.width / 2;
            let target = this.ball.x + (Math.random() - 0.5) * errorMargin;

            if (center < target - reactionDeadzone) player.x += aiSpeed;
            else if (center > target + reactionDeadzone) player.x -= aiSpeed;

            player.x = Math.max(0, Math.min(this.width - player.width, player.x));
        }
    }

    resetBall() {
        this.ball.x = this.width / 2;
        this.ball.y = this.height / 2;
        this.ball.speed = INITIAL_SPEED;

        // Random target direction
        const activePlayers = Object.values(this.players).filter(p => p.active);
        if (activePlayers.length === 0) return;

        const targetPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];

        let targetX, targetY;
        const randomOffset = (Math.random() - 0.5) * 0.8;

        if (targetPlayer.type === 'vertical') {
            targetX = targetPlayer.x + targetPlayer.width / 2;
            targetY = targetPlayer.y + targetPlayer.height / 2 + (targetPlayer.height * randomOffset);
        } else {
            targetX = targetPlayer.x + targetPlayer.width / 2 + (targetPlayer.width * randomOffset);
            targetY = targetPlayer.y + targetPlayer.height / 2;
        }

        const angle = Math.atan2(targetY - this.ball.y, targetX - this.ball.x);
        this.ball.vx = Math.cos(angle) * this.ball.speed;
        this.ball.vy = Math.sin(angle) * this.ball.speed;

        this.logAction('system', `Ball served towards ${targetPlayer.name}`);
    }

    updateBall() {
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Left Wall (P1)
        if (this.ball.x - BALL_RADIUS < 0) {
            if (this.players.p1.active && !this.checkPaddleCollision(this.players.p1)) {
                this.handleMiss('p1');
            } else if (!this.players.p1.active) {
                this.ball.vx *= -1;
                this.ball.x = BALL_RADIUS;
            }
        }

        // Right Wall (P2)
        if (this.ball.x + BALL_RADIUS > this.width) {
            if (this.players.p2.active && !this.checkPaddleCollision(this.players.p2)) {
                this.handleMiss('p2');
            } else if (!this.players.p2.active) {
                this.ball.vx *= -1;
                this.ball.x = this.width - BALL_RADIUS;
            }
        }

        // Top Wall (P4)
        if (this.ball.y - BALL_RADIUS < 0) {
            if (this.players.p4 && this.players.p4.active) {
                if (!this.checkPaddleCollision(this.players.p4)) this.handleMiss('p4');
            } else if (this.players.p4 && !this.players.p4.active) {
                this.ball.vy *= -1;
                this.ball.y = BALL_RADIUS;
            } else {
                this.ball.vy *= -1;
                this.ball.y = BALL_RADIUS;
            }
        }

        // Bottom Wall (P3)
        if (this.ball.y + BALL_RADIUS > this.height) {
            if (this.players.p3 && this.players.p3.active) {
                if (!this.checkPaddleCollision(this.players.p3)) this.handleMiss('p3');
            } else if (this.players.p3 && !this.players.p3.active) {
                this.ball.vy *= -1;
                this.ball.y = this.height - BALL_RADIUS;
            } else {
                this.ball.vy *= -1;
                this.ball.y = this.height - BALL_RADIUS;
            }
        }

        Object.values(this.players).forEach(p => {
            if (p.active && this.checkPaddleCollision(p)) {
                this.handlePaddleHit(p);
            }
        });
    }

    checkPaddleCollision(p) {
        return (
            this.ball.x + BALL_RADIUS > p.x &&
            this.ball.x - BALL_RADIUS < p.x + p.width &&
            this.ball.y + BALL_RADIUS > p.y &&
            this.ball.y - BALL_RADIUS < p.y + p.height
        );
    }

    handlePaddleHit(p) {
        this.ball.speed = Math.min(this.ball.speed * 1.05, 20);
        p.hits++;
        this.ball.lastHitBy = p.id;
        this.logAction(p.id, 'Hit Ball');

        if (p.type === 'vertical') {
            this.ball.vx *= -1;
            const center = p.y + p.height / 2;
            const hitPos = (this.ball.y - center) / (p.height / 2);
            this.ball.vy += hitPos * 2;

            if (p.side === 'left') this.ball.x = p.x + p.width + BALL_RADIUS;
            else this.ball.x = p.x - BALL_RADIUS;

        } else {
            this.ball.vy *= -1;
            const center = p.x + p.width / 2;
            const hitPos = (this.ball.x - center) / (p.width / 2);
            this.ball.vx += hitPos * 2;

            if (p.side === 'top') this.ball.y = p.y + p.height + BALL_RADIUS;
            else this.ball.y = p.y - BALL_RADIUS;
        }
    }

    handleMiss(playerId) {
        const p = this.players[playerId];
        p.lives--;
        this.logAction(playerId, `Lost Life. Remaining: ${p.lives}`);

        // Record effect for visual feedback
        this.lifeLostEffects.push({
            playerId,
            playerName: p.name,
            side: p.side,
            remainingLives: p.lives,
            timestamp: performance.now(),
        });

        if (p.lives <= 0) {
            p.active = false;
            this.logAction(playerId, 'Eliminated');
        }

        this.checkWinCondition();
        if (!this.winner) {
            this.resetBall();
        }
    }

    checkWinCondition() {
        const activePlayers = Object.values(this.players).filter(p => p.active);

        if (activePlayers.length <= 1) {
            this.winner = activePlayers.length === 1 ? activePlayers[0].name : "No One";
            const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

            const stats = {
                date: new Date().toISOString(),
                gameId: this.gameId,
                duration,
                winner: this.winner,
                ballSpeed: this.ball.speed.toFixed(2),
                theme: this.settings?.theme || 'unknown',
                language: this.settings?.language || 'unknown',
                players: Object.values(this.players).map(p => ({
                    name: p.name,
                    lives: p.lives,
                    hits: p.hits
                })),
                actionLog: this.actionLog
            };

            this.onGameOver(stats);
        }
    }
}
