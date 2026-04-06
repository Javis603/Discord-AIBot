const { generateGameEmbed } = require('../embedGenerator');
const { EmbedBuilder, Colors } = require('discord.js');

describe('embedGenerator', () => {
    test('generateGameEmbed should create a correct embed for a non-combat session', () => {
        const mockSession = {
            currentMission: 'Outer Perimeter Infiltration',
            playerLocation: { x: 1, y: 1 },
            playerHealth: 80,
            detectionLevel: 30,
            playerInventory: ['keycard', 'silencer'],
            mapState: [
                ['.', '.', '.'],
                ['.', '.', '.'],
                ['.', '.', '.']
            ],
            enemyPositions: [{ x: 0, y: 0, visionRange: 2 }],
            inCombat: false,
            turnOrder: 'player'
        };

        const embed = generateGameEmbed(mockSession);

        expect(embed).toBeInstanceOf(EmbedBuilder);
        const embedData = embed.toJSON();

        expect(embedData.title).toBe('Metal Gear Discord: Shadow Moses Incident');
        expect(embedData.description).toBe('**Mission:** Outer Perimeter Infiltration');
        expect(embedData.color).toBe(Colors.DarkGreen);

        expect(embedData.fields).toHaveLength(5); // Location, Health, Detection, Inventory, Map

        expect(embedData.fields[0].name).toBe('Location');
        expect(embedData.fields[0].value).toBe('(1, 1)');

        expect(embedData.fields[1].name).toBe('Health');
        expect(embedData.fields[1].value).toBe('80%');

        expect(embedData.fields[2].name).toBe('Detection');
        expect(embedData.fields[2].value).toBe('30%');

        expect(embedData.fields[3].name).toBe('Inventory');
        expect(embedData.fields[3].value).toBe('keycard, silencer');

        expect(embedData.fields[4].name).toBe('Map');
        expect(embedData.fields[4].value).toContain('🐍'); // Player icon
        expect(embedData.fields[4].value).toContain('🪖'); // Enemy icon
    });

    test('generateGameEmbed should create a correct embed for a combat session', () => {
        const mockSession = {
            currentMission: 'Outer Perimeter Infiltration',
            playerLocation: { x: 1, y: 1 },
            playerHealth: 80,
            detectionLevel: 30,
            playerInventory: ['keycard', 'silencer'],
            mapState: [
                ['.', '.', '.'],
                ['.', '.', '.'],
                ['.', '.', '.']
            ],
            enemyPositions: [{ x: 0, y: 0, visionRange: 2 }],
            inCombat: true,
            currentEnemy: 0,
            enemyHealth: [75],
            turnOrder: 'player'
        };

        const embed = generateGameEmbed(mockSession);
        const embedData = embed.toJSON();

        expect(embedData.color).toBe(Colors.Red);
        expect(embedData.fields).toHaveLength(8); // Additional combat fields

        expect(embedData.fields[5].name).toBe('Combat Status');
        expect(embedData.fields[5].value).toBe('In Combat!');

        expect(embedData.fields[6].name).toBe('Enemy Health');
        expect(embedData.fields[6].value).toBe('75%');

        expect(embedData.fields[7].name).toBe('Your Turn');
        expect(embedData.fields[7].value).toBe('Yes');
    });

    test('generateGameEmbed should handle empty inventory', () => {
        const mockSession = {
            currentMission: 'Outer Perimeter Infiltration',
            playerLocation: { x: 1, y: 1 },
            playerHealth: 80,
            detectionLevel: 30,
            playerInventory: [],
            mapState: [
                ['.', '.', '.'],
                ['.', '.', '.'],
                ['.', '.', '.']
            ],
            enemyPositions: [],
            inCombat: false,
            turnOrder: 'player'
        };

        const embed = generateGameEmbed(mockSession);
        const embedData = embed.toJSON();

        expect(embedData.fields[3].name).toBe('Inventory');
        expect(embedData.fields[3].value).toBe('Empty');
    });
});
