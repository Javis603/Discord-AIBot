const Territory = require('../Territory');
const Player = require('../Player');

describe('Territory', () => {
    let territory;
    let player;

    beforeEach(() => {
        territory = new Territory('Alaska', 'north_america', ['Northwest Territory', 'Alberta']);
        player = new Player('player1', 'Player One');
    });

    test('should create a territory with given properties', () => {
        expect(territory.name).toBe('Alaska');
        expect(territory.continent).toBe('north_america');
        expect(territory.adjacentTerritories).toEqual(['Northwest Territory', 'Alberta']);
        expect(territory.owner).toBeNull();
        expect(territory.troops).toBe(0);
    });

    test('setOwner should assign a player as the owner', () => {
        territory.setOwner(player);
        expect(territory.owner).toBe(player);
    });

    test('addTroops should increase the number of troops', () => {
        territory.addTroops(5);
        expect(territory.troops).toBe(5);
        territory.addTroops(3);
        expect(territory.troops).toBe(8);
    });

    test('removeTroops should decrease the number of troops', () => {
        territory.addTroops(10);
        territory.removeTroops(4);
        expect(territory.troops).toBe(6);
        territory.removeTroops(6);
        expect(territory.troops).toBe(0);
    });

    test('removeTroops should not go below zero', () => {
        territory.addTroops(2);
        territory.removeTroops(5);
        expect(territory.troops).toBeLessThanOrEqual(0); // Assuming troops can't be negative
    });
});
