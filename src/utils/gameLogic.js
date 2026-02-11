
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const PADDLE_WIDTH = 10;
export const PADDLE_HEIGHT = 100;
export const BALL_RADIUS = 8;
export const INITIAL_SPEED = 6.5;
export const SQUARE_SIZE = 700;

export class GameEngine {
    constructor(settings, onGameOver) {
        this.settings = settings;
        this.onGameOver = onGameOver;
        this.mode = settings.mode;
        this.width = (this.mode === '3P' || this.mode === '4P') ? SQUARE_SIZE : CANVAS_WIDTH;
        this.height = (this.mode === '3P' || this.mode === '4P') ? SQUARE_SIZE : CANVAS_HEIGHT;

        const cpuSettings = settings.cpuSettings || {};
        const livesMap = settings.livesMap || {};
        const defaultLives = settings.initialLives || 1;

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
                difficulty: cpuSettings.p1 || null,
                totalDistance: 0,
                lastX: 20, lastY: this.height / 2 - PADDLE_HEIGHT / 2,
                positionSamples: []
            },
            p2: {
                id: 'p2', name: settings.players.p2,
                x: this.width - 30, y: this.height / 2 - PADDLE_HEIGHT / 2,
                width: PADDLE_WIDTH, height: PADDLE_HEIGHT,
                score: 0, lives: livesMap.p2 ?? defaultLives, active: true, hits: 0,
                type: 'vertical', side: 'right',
                isAI: !!cpuSettings.p2,
                difficulty: cpuSettings.p2 || null,
                totalDistance: 0,
                lastX: this.width - 30, lastY: this.height / 2 - PADDLE_HEIGHT / 2,
                positionSamples: []
            },
        };

        if (this.mode === '3P' || this.mode === '4P') {
            this.players.p1.y = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;
            this.players.p2.x = SQUARE_SIZE - 30;
            this.players.p2.y = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;
            this.players.p1.lastY = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;
            this.players.p2.lastX = SQUARE_SIZE - 30;
            this.players.p2.lastY = SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2;

            this.players.p3 = {
                id: 'p3', name: settings.players.p3,
                x: SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2, y: SQUARE_SIZE - 30,
                width: PADDLE_HEIGHT, height: PADDLE_WIDTH,
                score: 0, lives: livesMap.p3 ?? defaultLives, active: true, hits: 0,
                type: 'horizontal', side: 'bottom',
                isAI: !!cpuSettings.p3,
                difficulty: cpuSettings.p3 || null,
                totalDistance: 0,
                lastX: SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2, lastY: SQUARE_SIZE - 30,
                positionSamples: []
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
                difficulty: cpuSettings.p4 || null,
                totalDistance: 0,
                lastX: SQUARE_SIZE / 2 - PADDLE_HEIGHT / 2, lastY: 20,
                positionSamples: []
            };
        }

        this.startTime = Date.now();
        this.gameId = `G${this.startTime}-${Math.floor(Math.random() * 1000)}`;
        this.winner = null;
        this.ranking = null;
        this.eliminations = [];
        this.actionLog = [];
        this.countdown = 3;
        this.isPaused = true;

        // === TELEMETRY DATA ===
        this.telemetry = [];
        this.lastTelemetryTime = 0;
        this.telemetryInterval = 100;

        // Rally tracking
        this.currentRally = {
            hits: 0,
            startTime: null,
            lastHitTime: null,
            participants: new Set(),
            startBallSpeed: this.ball.speed
        };
        this.rallies = [];

        // Hit details tracking
        this.hitDetails = [];

        // Miss tracking
        this.missDetails = [];

        // Paddle movement tracking per player
        this.paddleMovement = {};
        Object.keys(this.players).forEach(pid => {
            this.paddleMovement[pid] = {
                totalDistance: 0,
                timeMoving: 0,
                lastMoveTime: null,
                idleTime: 0,
                positionSamples: []
            };
        });

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
                this.currentRally.startTime = Date.now() - this.startTime;
                this.resetBall();
            }
        }, 1000);
    }

    logAction(playerId, action, details = null) {
        const playerName = playerId === 'system' ? 'System' : (this.players[playerId]?.name || playerId);
        const entry = {
            timestamp: Date.now() - this.startTime,
            player: playerName,
            action: action
        };
        if (details) {
            entry.details = details;
        }
        this.actionLog.push(entry);
    }

    recordTelemetry() {
        const now = Date.now() - this.startTime;
        if (now - this.lastTelemetryTime < this.telemetryInterval) return;

        const telemetryEntry = {
            timestamp: now,
            ball: {
                x: this.ball.x.toFixed(2),
                y: this.ball.y.toFixed(2),
                vx: this.ball.vx.toFixed(4),
                vy: this.ball.vy.toFixed(4),
                speed: this.ball.speed.toFixed(4)
            },
            players: {}
        };

        Object.values(this.players).forEach(p => {
            const pos = p.type === 'vertical' ? p.y : p.x;
            const center = pos + (p.type === 'vertical' ? p.height : p.width) / 2;

            // Calculate distance moved since last telemetry
            let distance = 0;
            if (p.lastX !== undefined && p.lastY !== undefined) {
                distance = Math.sqrt(Math.pow(p.x - p.lastX, 2) + Math.pow(p.y - p.lastY, 2));
            }
            p.totalDistance = (p.totalDistance || 0) + distance;
            p.lastX = p.x;
            p.lastY = p.y;

            telemetryEntry.players[p.id] = {
                x: p.x.toFixed(2),
                y: p.y.toFixed(2),
                center: center.toFixed(2),
                active: p.active,
                lives: p.lives,
                hits: p.hits,
                distanceMoved: distance.toFixed(2),
                totalDistance: p.totalDistance.toFixed(2)
            };
        });

        this.telemetry.push(telemetryEntry);
        this.lastTelemetryTime = now;
    }

    update(input) {
        if (this.winner || this.isPaused) return;

        // Speed Increase (1% per second approx, called 60 times/sec)
        this.ball.speed *= 1.00016;

        this.handleInput(input);
        this.updateBall();
        this.recordTelemetry();
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

        this.logAction('system', `Ball served towards ${targetPlayer.name}`, {
            targetPlayer: targetPlayer.name,
            targetPlayerId: targetPlayer.id,
            serveAngle: (angle * 180 / Math.PI).toFixed(2)
        });

        this.currentRally = {
            hits: 0,
            startTime: Date.now() - this.startTime,
            lastHitTime: null,
            participants: new Set(),
            startBallSpeed: this.ball.speed
        };
    }

    updateBall() {
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        if (this.ball.x - BALL_RADIUS < 0) {
            if (this.players.p1.active && !this.checkPaddleCollision(this.players.p1)) {
                this.handleMiss('p1');
            } else if (!this.players.p1.active) {
                this.ball.vx *= -1;
                this.ball.x = BALL_RADIUS;
            }
        }

        if (this.ball.x + BALL_RADIUS > this.width) {
            if (this.players.p2.active && !this.checkPaddleCollision(this.players.p2)) {
                this.handleMiss('p2');
            } else if (!this.players.p2.active) {
                this.ball.vx *= -1;
                this.ball.x = this.width - BALL_RADIUS;
            }
        }

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
        const oldSpeed = this.ball.speed;
        this.ball.speed = Math.min(this.ball.speed * 1.05, 20);
        p.hits++;

        let hitPosition = 0;
        if (p.type === 'vertical') {
            const center = p.y + p.height / 2;
            hitPosition = (this.ball.y - center) / (p.height / 2);
        } else {
            const center = p.x + p.width / 2;
            hitPosition = (this.ball.x - center) / (p.width / 2);
        }

        const oldAngle = Math.atan2(this.ball.vy, this.ball.vx);

        this.ball.lastHitBy = p.id;

        if (this.currentRally.hits === 0) {
            this.currentRally.startTime = Date.now() - this.startTime;
        }
        this.currentRally.hits++;
        this.currentRally.lastHitTime = Date.now() - this.startTime;
        this.currentRally.participants.add(p.id);

        let reactionTime = null;
        if (this.hitDetails.length > 0) {
            const lastHit = this.hitDetails[this.hitDetails.length - 1];
            reactionTime = Date.now() - this.startTime - lastHit.timestamp;
        }

        const hitDetail = {
            timestamp: Date.now() - this.startTime,
            playerId: p.id,
            playerName: p.name,
            ballX: this.ball.x.toFixed(2),
            ballY: this.ball.y.toFixed(2),
            ballSpeedBefore: oldSpeed.toFixed(4),
            ballSpeedAfter: this.ball.speed.toFixed(4),
            hitPosition: hitPosition.toFixed(4),
            paddleCenter: (p.type === 'vertical' ? p.y + p.height / 2 : p.x + p.width / 2).toFixed(2),
            ballAngleBefore: (oldAngle * 180 / Math.PI).toFixed(2),
            rallyHitNumber: this.currentRally.hits,
            reactionTime: reactionTime,
            isAI: p.isAI,
            difficulty: p.difficulty
        };
        this.hitDetails.push(hitDetail);

        this.logAction(p.id, 'Hit Ball', {
            ballSpeed: this.ball.speed.toFixed(2),
            hitPosition: hitPosition.toFixed(2),
            rallyHits: this.currentRally.hits
        });

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

        hitDetail.ballAngleAfter = (Math.atan2(this.ball.vy, this.ball.vx) * 180 / Math.PI).toFixed(2);
    }

    handleMiss(playerId) {
        const p = this.players[playerId];
        const missTime = Date.now() - this.startTime;

        if (this.currentRally.hits > 0) {
            this.currentRally.endTime = missTime;
            this.currentRally.duration = missTime - this.currentRally.startTime;
            this.currentRally.endedBy = playerId;
            this.currentRally.participants = Array.from(this.currentRally.participants);
            this.rallies.push({ ...this.currentRally });
        }

        const missDetail = {
            timestamp: missTime,
            playerId: playerId,
            playerName: p.name,
            ballX: this.ball.x.toFixed(2),
            ballY: this.ball.y.toFixed(2),
            ballSpeed: this.ball.speed.toFixed(4),
            livesBefore: p.lives,
            rallyHits: this.currentRally.hits,
            isAI: p.isAI
        };
        this.missDetails.push(missDetail);

        p.lives--;
        this.logAction(playerId, `Lost Life. Remaining: ${p.lives}`, {
            missLocation: this.ball.x < 0 ? 'left' : this.ball.x > this.width ? 'right' :
                         this.ball.y < 0 ? 'top' : 'bottom',
            ballSpeed: this.ball.speed.toFixed(2),
            rallyHits: this.currentRally.hits
        });

        this.lifeLostEffects.push({
            playerId,
            playerName: p.name,
            side: p.side,
            remainingLives: p.lives,
            timestamp: performance.now(),
        });

        this.currentRally = {
            hits: 0,
            startTime: null,
            lastHitTime: null,
            participants: new Set(),
            startBallSpeed: this.ball.speed
        };

        if (p.lives <= 0) {
            p.active = false;
            if (!this.eliminations.find(e => e.id === playerId)) {
                this.eliminations.push({ id: playerId, name: p.name, time: Date.now() - this.startTime });
            }
            this.logAction(playerId, 'Eliminated', { survivalTime: (Date.now() - this.startTime) / 1000 });
        }

        this.checkWinCondition();
        if (!this.winner) {
            this.resetBall();
        }
    }

    calculateMetrics() {
        const metrics = {
            ball: {},
            rallies: {},
            players: {},
            timing: {}
        };

        if (this.telemetry.length > 0) {
            const speeds = this.telemetry.map(t => parseFloat(t.ball.speed));
            metrics.ball.avgSpeed = (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(2);
            metrics.ball.maxSpeed = Math.max(...speeds).toFixed(2);
            metrics.ball.minSpeed = Math.min(...speeds).toFixed(2);
        }

        if (this.rallies.length > 0) {
            const rallyLengths = this.rallies.map(r => r.hits);
            metrics.rallies.total = this.rallies.length;
            metrics.rallies.avgLength = (rallyLengths.reduce((a, b) => a + b, 0) / rallyLengths.length).toFixed(2);
            metrics.rallies.maxLength = Math.max(...rallyLengths);
            metrics.rallies.minLength = Math.min(...rallyLengths);

            const rallyDurations = this.rallies.map(r => r.duration || 0);
            metrics.rallies.avgDuration = (rallyDurations.reduce((a, b) => a + b, 0) / rallyDurations.length / 1000).toFixed(2);
        }

        Object.values(this.players).forEach(p => {
            const playerHits = this.hitDetails.filter(h => h.playerId === p.id);
            const playerMisses = this.missDetails.filter(m => m.playerId === p.id);

            metrics.players[p.id] = {
                name: p.name,
                totalHits: p.hits,
                totalMisses: playerMisses.length,
                hitAccuracy: playerHits.length > 0 ?
                    (playerHits.filter(h => Math.abs(parseFloat(h.hitPosition)) < 0.5).length / playerHits.length * 100).toFixed(1) : 0,
                avgHitPosition: playerHits.length > 0 ?
                    (playerHits.reduce((a, h) => a + Math.abs(parseFloat(h.hitPosition)), 0) / playerHits.length).toFixed(3) : 0,
                maxBallSpeedOnHit: playerHits.length > 0 ?
                    Math.max(...playerHits.map(h => parseFloat(h.ballSpeedBefore))).toFixed(2) : 0,
                avgReactionTime: playerHits.length > 0 ?
                    (playerHits.filter(h => h.reactionTime !== null).reduce((a, h) => a + h.reactionTime, 0) /
                    playerHits.filter(h => h.reactionTime !== null).length / 1000).toFixed(3) : 0,
                totalDistanceMoved: p.totalDistance ? p.totalDistance.toFixed(2) : 0,
                isAI: p.isAI,
                difficulty: p.difficulty,
                survivalTime: this.eliminations.find(e => e.id === p.id)?.time ||
                    (this.winner ? Date.now() - this.startTime : null)
            };
        });

        const gameDuration = Date.now() - this.startTime;
        metrics.timing.gameDuration = (gameDuration / 1000).toFixed(2);
        metrics.timing.avgTimeBetweenHits = this.hitDetails.length > 1 ?
            ((this.hitDetails[this.hitDetails.length - 1].timestamp - this.hitDetails[0].timestamp) / (this.hitDetails.length - 1) / 1000).toFixed(3) : 0;

        return metrics;
    }

    checkWinCondition() {
        const activePlayers = Object.values(this.players).filter(p => p.active);

        if (activePlayers.length <= 1) {
            this.winner = activePlayers.length === 1 ? activePlayers[0].name : "No One";

            this.ranking = [];
            if (activePlayers.length === 1) {
                this.ranking.push({ place: 1, name: activePlayers[0].name });
            }
            const reversedEliminations = [...this.eliminations].reverse();
            reversedEliminations.forEach((p, index) => {
                this.ranking.push({ place: this.ranking.length + 1, name: p.name });
            });

            const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

            const metrics = this.calculateMetrics();

            const stats = {
                date: new Date().toISOString(),
                gameId: this.gameId,
                duration,
                winner: this.winner,
                ranking: this.ranking,
                ballSpeed: this.ball.speed.toFixed(2),
                theme: this.settings?.theme || 'unknown',
                language: this.settings?.language || 'unknown',
                players: Object.values(this.players).map(p => ({
                    name: p.name,
                    lives: p.lives,
                    hits: p.hits,
                    totalDistance: p.totalDistance?.toFixed(2) || 0,
                    isAI: p.isAI,
                    difficulty: p.difficulty
                })),
                actionLog: this.actionLog,
                telemetry: this.telemetry,
                hitDetails: this.hitDetails,
                missDetails: this.missDetails,
                rallies: this.rallies,
                metrics: metrics,
                settings: {
                    mode: this.mode,
                    initialLives: this.settings.initialLives,
                    cpuSettings: this.settings.cpuSettings
                }
            };

            this.onGameOver(stats);
        }
    }
}
