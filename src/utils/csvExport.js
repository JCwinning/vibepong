export const exportToCSV = (gameData) => {
    // gameData: { date, duration, winner, players: [...], actionLog: [...] }

    // 1. Summary CSV
    // 1. Summary CSV
    const summaryHeaders = ['Game ID', 'Date', 'Duration (s)', 'Winner', 'Ball Speed', 'Player', 'Lives', 'Hits'];
    const summaryRows = [];

    gameData.players.forEach(player => {
        summaryRows.push([
            gameData.gameId,
            gameData.date,
            gameData.duration,
            gameData.winner,
            gameData.ballSpeed,
            player.name,
            player.lives,
            player.hits || 0
        ]);
    });

    saveToServer(summaryHeaders, summaryRows, `vibepong_summary_${gameData.gameId}.csv`);

    // 2. Action Log CSV
    if (gameData.actionLog && gameData.actionLog.length > 0) {
        const actionHeaders = ['Game ID', 'Timestamp (ms)', 'Player', 'Action'];
        const actionRows = gameData.actionLog.map(log => [
            gameData.gameId,
            log.timestamp,
            log.player,
            log.action
        ]);

        // Add a small delay to ensure both saves trigger
        setTimeout(() => {
            saveToServer(actionHeaders, actionRows, `vibepong_actions_${gameData.gameId}.csv`);
        }, 500);
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
