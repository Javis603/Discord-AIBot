function moveEnemies(session) {
    session.enemyPositions.forEach(enemy => {
        if (enemy.patrolPath && enemy.patrolPath.length > 0) {
            // Find current position in patrol path
            let currentIndex = enemy.patrolPath.findIndex(p => p.x === enemy.x && p.y === enemy.y);
            if (currentIndex === -1) {
                // If enemy is not on its patrol path, move it to the start
                enemy.x = enemy.patrolPath[0].x;
                enemy.y = enemy.patrolPath[0].y;
            } else {
                // Move to the next point in the patrol path
                currentIndex = (currentIndex + 1) % enemy.patrolPath.length;
                enemy.x = enemy.patrolPath[currentIndex].x;
                enemy.y = enemy.patrolPath[currentIndex].y;
            }
        }
    });
    return session;
}

function checkDetection(session) {
    let detected = false;
    session.enemyPositions.forEach(enemy => {
        const dx = Math.abs(session.playerLocation.x - enemy.x);
        const dy = Math.abs(session.playerLocation.y - enemy.y);

        // Simple distance-based detection for now
        if (dx <= enemy.visionRange && dy <= enemy.visionRange) {
            // More sophisticated line-of-sight checks can be added here later
            detected = true;
        }
    });
    return detected;
}

module.exports = { moveEnemies, checkDetection };