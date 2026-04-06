const { moveEnemies, checkDetection } = require('../enemyAI');

describe('enemyAI', () => {
    let mockSession;

    beforeEach(() => {
        mockSession = {
            playerLocation: { x: 1, y: 1 },
            enemyPositions: [
                { x: 0, y: 0, direction: 'south', patrolPath: [{ x: 0, y: 0 }, { x: 0, y: 1 }], visionRange: 2 },
                { x: 2, y: 2, direction: 'north', patrolPath: [{ x: 2, y: 2 }, { x: 2, y: 1 }], visionRange: 1 }
            ]
        };
    });

    describe('moveEnemies', () => {
        test('should move enemies along their patrol path', () => {
            const updatedSession = moveEnemies(mockSession);

            // Enemy 1 moves from (0,0) to (0,1)
            expect(updatedSession.enemyPositions[0].x).toBe(0);
            expect(updatedSession.enemyPositions[0].y).toBe(1);

            // Enemy 2 moves from (2,2) to (2,1)
            expect(updatedSession.enemyPositions[1].x).toBe(2);
            expect(updatedSession.enemyPositions[1].y).toBe(1);

            // Move again to test path cycling
            const furtherUpdatedSession = moveEnemies(updatedSession);
            expect(furtherUpdatedSession.enemyPositions[0].x).toBe(0);
            expect(furtherUpdatedSession.enemyPositions[0].y).toBe(0); // Cycled back
        });

        test('should handle enemies without a patrol path', () => {
            mockSession.enemyPositions.push({ x: 5, y: 5, visionRange: 3 }); // Enemy without patrol path
            const updatedSession = moveEnemies(mockSession);
            expect(updatedSession.enemyPositions[2].x).toBe(5);
            expect(updatedSession.enemyPositions[2].y).toBe(5); // Should not move
        });

        test('should move enemy to start of patrol path if not currently on it', () => {
            mockSession.enemyPositions[0].x = 99; // Not on patrol path
            mockSession.enemyPositions[0].y = 99;
            const updatedSession = moveEnemies(mockSession);
            expect(updatedSession.enemyPositions[0].x).toBe(0);
            expect(updatedSession.enemyPositions[0].y).toBe(0);
        });
    });

    describe('checkDetection', () => {
        test('should return true if player is within an enemy\'s vision range', () => {
            // Player at (1,1), Enemy 1 at (0,0) with visionRange 2. Player is within range.
            expect(checkDetection(mockSession)).toBe(true);
        });

        test('should return false if player is outside all enemies\' vision range', () => {
            mockSession.playerLocation = { x: 5, y: 5 }; // Move player far away
            expect(checkDetection(mockSession)).toBe(false);
        });

        test('should return false if no enemies are present', () => {
            mockSession.enemyPositions = [];
            expect(checkDetection(mockSession)).toBe(false);
        });

        test('should return true if player is exactly at the edge of vision range', () => {
            mockSession.playerLocation = { x: 2, y: 0 }; // dx=2, dy=0 for enemy 1 (0,0), vision 2
            mockSession.enemyPositions[0].visionRange = 2;
            expect(checkDetection(mockSession)).toBe(true);
        });

        test('should return false if player is just outside vision range', () => {
            mockSession.playerLocation = { x: 3, y: 0 }; // dx=3, dy=0 for enemy 1 (0,0), vision 2
            mockSession.enemyPositions[0].visionRange = 2;
            expect(checkDetection(mockSession)).toBe(false);
        });
    });
});
