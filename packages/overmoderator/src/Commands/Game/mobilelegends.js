const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Game = require('../../Games/MobileLegends/Game');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mobilelegends')
        .setDescription('Play a game of Mobile Legends hero guessing!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starts a new game of Mobile Legends hero guessing'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join an existing game'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('guess')
                .setDescription('Guess the hero\'s name')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the hero')
                        .setRequired(true))),
    async execute(interaction, client, game) {
        if (interaction.options.getSubcommand() === 'start') {
            if (game) {
                return interaction.reply('A game is already in progress!');
            }
            const newGame = new Game();
            await newGame.fetchHeroes();
            newGame.hero = newGame.getRandomHero();
            newGame.addPlayer(interaction.user.id);

            if (!newGame.hero) {
                return interaction.reply('Failed to fetch hero data. Please try again later.');
            }

            const silhouette = await newGame.getHeroSilhouette();
            if (!silhouette) {
                return interaction.reply('Failed to create hero silhouette. Please try again later.');
            }

            const attachment = new AttachmentBuilder(silhouette, { name: 'silhouette.png' });

            await interaction.reply({ content: `A new game of Mobile Legends hero guessing has been created! Guess the hero in the image!`, files: [attachment] });
            return newGame;
        } else if (interaction.options.getSubcommand() === 'join') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/mobilelegends start`!');
            }
            if (game.players.includes(interaction.user.id)) {
                return interaction.reply('You have already joined this game!');
            }
            game.addPlayer(interaction.user.id);
            await interaction.reply(`${interaction.user.username} has joined the game! Current players: ${game.players.length}.`);
        } else if (interaction.options.getSubcommand() === 'guess') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/mobilelegends start`!');
            }
            if (!game.players.includes(interaction.user.id)) {
                return interaction.reply('You have not joined this game yet! Join with `/mobilelegends join`.');
            }

            const guess = interaction.options.getString('name');
            if (game.checkGuess(guess)) {
                const score = (game.scores.get(interaction.user.id) || 0) + 1;
                game.scores.set(interaction.user.id, score);
                game.hero = game.getRandomHero();

                if (!game.hero) {
                    return interaction.reply('Failed to fetch hero data. Please try again later.');
                }

                const silhouette = await game.getHeroSilhouette();
                if (!silhouette) {
                    return interaction.reply('Failed to create hero silhouette. Please try again later.');
                }

                const attachment = new AttachmentBuilder(silhouette, { name: 'silhouette.png' });

                await interaction.reply({ content: `Correct! ${interaction.user.username} guessed the hero. Your score is now ${score}. New round! Guess the hero in the image!`, files: [attachment] });
            } else {
                await interaction.reply(`Incorrect guess, ${interaction.user.username}. Try again!`);
            }
        }
    },
};
