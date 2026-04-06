const mobileLegendsCommand = require('../mobilelegends');
const Game = require('../../../Games/MobileLegends/Game');

jest.mock('../../../Games/MobileLegends/Game');

describe('Mobile Legends Game', () => {
    let interaction;

    beforeEach(() => {
        interaction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
            },
            reply: jest.fn(),
            user: {
                id: 'user-1',
                username: 'TestUser',
            },
        };
        Game.mockClear();
    });

    describe('start subcommand', () => {
        it('should start a new game', async () => {
            interaction.options.getSubcommand.mockReturnValue('start');

            const mockGameInstance = {
                fetchHeroes: jest.fn(),
                getRandomHero: jest.fn().mockReturnValue({ name: 'Test Hero' }),
                addPlayer: jest.fn(),
                getHeroSilhouette: jest.fn().mockResolvedValue(Buffer.from('silhouette')),
                hero: { name: 'Test Hero' },
            };
            Game.mockImplementation(() => mockGameInstance);

            const newGame = await mobileLegendsCommand.execute(interaction, null, null);

            expect(Game).toHaveBeenCalledTimes(1);
            expect(newGame).toBeDefined();
            expect(newGame.fetchHeroes).toHaveBeenCalledTimes(1);
            expect(newGame.getRandomHero).toHaveBeenCalledTimes(1);
            expect(newGame.addPlayer).toHaveBeenCalledWith('user-1');
            expect(newGame.getHeroSilhouette).toHaveBeenCalledTimes(1);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'A new game of Mobile Legends hero guessing has been created! Guess the hero in the image!',
                files: [expect.any(Object)],
            });
        });
    });

    describe('join subcommand', () => {
        it('should allow a user to join a game', async () => {
            interaction.options.getSubcommand.mockReturnValue('join');

            const mockGameInstance = {
                players: [],
                addPlayer: jest.fn(),
            };

            await mobileLegendsCommand.execute(interaction, null, mockGameInstance);

            expect(mockGameInstance.addPlayer).toHaveBeenCalledWith('user-1');
            expect(interaction.reply).toHaveBeenCalledWith('TestUser has joined the game! Current players: 0.');
        });
    });

    describe('guess subcommand', () => {
        let mockGameInstance;

        beforeEach(() => {
            mockGameInstance = {
                players: ['user-1'],
                checkGuess: jest.fn(),
                scores: new Map([['user-1', 0]]),
                getRandomHero: jest.fn().mockReturnValue({ name: 'New Test Hero' }),
                getHeroSilhouette: jest.fn().mockResolvedValue(Buffer.from('new_silhouette')),
                hero: { name: 'New Test Hero' },
            };
        });

        it('should handle a correct guess', async () => {
            interaction.options.getSubcommand.mockReturnValue('guess');
            interaction.options.getString.mockReturnValue('Test Hero');
            mockGameInstance.checkGuess.mockReturnValue(true);

            await mobileLegendsCommand.execute(interaction, null, mockGameInstance);

            expect(mockGameInstance.checkGuess).toHaveBeenCalledWith('Test Hero');
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Correct! TestUser guessed the hero. Your score is now 1. New round! Guess the hero in the image!',
                files: [expect.any(Object)],
            });
        });

        it('should handle an incorrect guess', async () => {
            interaction.options.getSubcommand.mockReturnValue('guess');
            interaction.options.getString.mockReturnValue('Wrong Hero');
            mockGameInstance.checkGuess.mockReturnValue(false);

            await mobileLegendsCommand.execute(interaction, null, mockGameInstance);

            expect(mockGameInstance.checkGuess).toHaveBeenCalledWith('Wrong Hero');
            expect(interaction.reply).toHaveBeenCalledWith('Incorrect guess, TestUser. Try again!');
        });
    });
});
