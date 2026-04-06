const Player = require('../Player');

describe('Player', () => {
    test('should create a player with given ID and default properties', () => {
        const player = new Player('test-id', 'Test Player');
        expect(player.id).toBe('test-id');
        expect(player.name).toBe('Test Player');
        expect(player.territories).toEqual([]);
        expect(player.cards).toEqual([]);
        expect(player.troopsToDeploy).toBe(0);
    });

    test('should create a player with only ID if name is not provided', () => {
        const player = new Player('another-id');
        expect(player.id).toBe('another-id');
        expect(player.name).toBeUndefined(); // Or null, depending on desired behavior
        expect(player.territories).toEqual([]);
        expect(player.cards).toEqual([]);
        expect(player.troopsToDeploy).toBe(0);
    });
});
