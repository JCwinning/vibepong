export const exportToCSV = (gameData) => {
    // gameData now includes: date, duration, winner, players, actionLog,
    // telemetry, hitDetails, missDetails, rallies, metrics, settings

    const gameId = gameData.gameId;

    // 1. Summary CSV (existing)
    const summaryHeaders = ['Game ID', 'Date', 'Duration (s)', 'Winner', 'Ball Speed', 'Theme', 'Language', 'Player', 'Lives', 'Hits', 'CPU Difficulty'];
    const summaryRows = [];

    gameData.players.forEach(player => {
        summaryRows.push([
            gameId,
            gameData.date,
            gameData.duration,
            gameData.winner,
            gameData.ballSpeed,
            gameData.theme,
            gameData.language,
            player.name,
            player.lives,
            player.hits || 0,
            player.difficulty || (player.isAI ? 'unknown' : 'N/A')
        ]);
    });

    saveToServer(summaryHeaders, summaryRows, `vibepong_summary_${gameId}.csv`);

    // 2. Action Log CSV (existing, enhanced with details)
    if (gameData.actionLog && gameData.actionLog.length > 0) {
        const actionHeaders = ['Game ID', 'Timestamp (ms)', 'Player', 'Action', 'Details'];
        const actionRows = gameData.actionLog.map(log => [
            gameId,
            log.timestamp,
            log.player,
            log.action,
            log.details ? JSON.stringify(log.details) : ''
        ]);

        setTimeout(() => {
            saveToServer(actionHeaders, actionRows, `vibepong_actions_${gameId}.csv`);
        }, 100);
    }

    // 3. Telemetry CSV (NEW - sampled ball and paddle positions every 100ms)
    if (gameData.telemetry && gameData.telemetry.length > 0) {
        const telemetryHeaders = [
            'Game ID', 'Timestamp (ms)', 'Ball X', 'Ball Y', 'Ball VX', 'Ball VY', 'Ball Speed'
        ];
        // Add player-specific columns dynamically
        const playerIds = Object.keys(gameData.telemetry[0].players || {});
        playerIds.forEach(pid => {
            telemetryHeaders.push(`${pid} X`, `${pid} Y`, `${pid} Center`, `${pid} Active`, `${pid} Lives`, `${pid} Distance`);
        });

        const telemetryRows = gameData.telemetry.map(t => {
            const row = [
                gameId,
                t.timestamp,
                t.ball.x,
                t.ball.y,
                t.ball.vx,
                t.ball.vy,
                t.ball.speed
            ];
            playerIds.forEach(pid => {
                const p = t.players[pid];
                if (p) {
                    row.push(p.x, p.y, p.center, p.active ? 1 : 0, p.lives, p.distanceMoved);
                } else {
                    row.push('', '', '', '', '', '');
                }
            });
            return row;
        });

        setTimeout(() => {
            saveToServer(telemetryHeaders, telemetryRows, `vibepong_telemetry_${gameId}.csv`);
        }, 200);
    }

    console.log("CSV files request sent to server.");
};

const saveToServer = (headers, rows, filename) => {
    const csvContent = headers.join(",") + "\n"
        + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    fetch('/api/save-csv', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename,
            content: csvContent
        })
    })
        .then(response => {
            if (response.ok) {
                console.log(`File saved: ${filename}`);
            } else {
                console.error(`Failed to save file: ${filename}`);
            }
        })
        .catch(error => {
            console.error("Error saving file:", error);
        });
};
