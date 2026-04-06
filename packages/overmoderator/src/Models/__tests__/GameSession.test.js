const GameSession = require('../GameSession');
const mongoose = require('mongoose');

describe('GameSession Model', () => {
    test('should be able to instantiate a GameSession model', () => {
        const session = new GameSession();
        expect(session).toBeDefined();
        expect(session).toBeInstanceOf(mongoose.Model);
    });

    test('should have correct schema properties', () => {
        const session = new GameSession({
            userId: 'user123',
            channelId: 'channel456',
            playerLocation: { x: 1, y: 2 },
            playerHealth: 90,
            playerInventory: ['sword', 'shield'],
            currentMission: 'Test Mission',
            mapState: [['.', '#'], ['P', '.']],
            enemyPositions: [{ x: 0, y: 0, direction: 'north', patrolPath: [{ x: 0, y: 0 }], visionRange: 3 }],
            detectionLevel: 50,
            inCombat: true,
            currentEnemy: 0,
            enemyHealth: [70],
            turnOrder: 'enemy'
        });

        expect(session.userId).toBe('user123');
        expect(session.channelId).toBe('channel456');
        expect(session.playerLocation.x).toBe(1);
        expect(session.playerLocation.y).toBe(2);
        expect(session.playerHealth).toBe(90);
        expect(session.playerInventory).toEqual(['sword', 'shield']);
        expect(session.currentMission).toBe('Test Mission');
        expect(session.mapState).toEqual([['.', '#'], ['P', '.']]);
        expect(session.enemyPositions[0].x).toBe(0);
        expect(session.enemyPositions[0].direction).toBe('north');
        expect(session.detectionLevel).toBe(50);
        expect(session.inCombat).toBe(true);
        expect(session.currentEnemy).toBe(0);
        expect(session.enemyHealth).toEqual([70]);
        expect(session.turnOrder).toBe('enemy');
        expect(session.lastUpdated).toBeDefined();
    });
});
