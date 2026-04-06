const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const WordFuddleManager = require('../../Utils/Games/WordFuddleManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordfuddle')
        .setDescription('Play a game of Word Fuddle - unscramble the words!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('new')
                .setDescription('Start a new Word Fuddle game')
                .addIntegerOption(option =>
                    option.setName('rounds')
                        .setDescription('Number of rounds (default: 10)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join an existing Word Fuddle game')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The message ID of the game (right-click the game message -> Copy ID)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hint')
                .setDescription('Get a hint for the current word')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The message ID of the game')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip the current word (game starter only)')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The message ID of the game')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { client } = interaction;

        try {
            if (subcommand === 'new') {
                const rounds = interaction.options.getInteger('rounds') || 10;
                const game = await WordFuddleManager.createGame(
                    interaction.channelId,
                    interaction.guildId,
                    interaction.user.id
                );

                if (rounds > 0) {
                    game.maxRounds = Math.min(rounds, 50); // Cap at 50 rounds
                    await game.save();
                }

                const embed = WordFuddleManager.getGameEmbed(game, client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                const message = await interaction.reply({
                    embeds: [embed],
                    components,
                    fetchReply: true
                });

                game.messageId = message.id;
                await game.save();
            }
            else if (subcommand === 'join') {
                const messageId = interaction.options.getString('message_id');
                const game = await WordFuddleManager.joinGame(messageId, interaction.user.id);

                const embed = WordFuddleManager.getGameEmbed(game, client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.reply({
                    content: `${interaction.user} has joined the game!`,
                    ephemeral: true
                });

                await interaction.channel.messages.fetch(messageId)
                    .then(msg => msg.edit({ embeds: [embed], components }))
                    .catch(console.error);
            }
            else if (subcommand === 'hint') {
                const messageId = interaction.options.getString('message_id');
                const game = await WordFuddleManager.giveHint(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.reply({
                    content: 'Here\'s a hint!',
                    ephemeral: true
                });

                await interaction.channel.messages.fetch(messageId)
                    .then(msg => msg.edit({ embeds: [embed], components }))
                    .catch(console.error);
            }
            else if (subcommand === 'skip') {
                const messageId = interaction.options.getString('message_id');
                const game = await WordFuddleManager.skipWord(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.reply({
                    content: 'Word skipped!',
                    ephemeral: true
                });

                await interaction.channel.messages.fetch(messageId)
                    .then(msg => msg.edit({ embeds: [embed], components }))
                    .catch(console.error);
            }
        } catch (error) {
            console.error('WordFuddle command error:', error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ Error: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    },

    // This will be called by the interactionCreate handler
    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('wordfuddle_')) return;

        const [_, action, messageId] = interaction.customId.split('_');

        try {
            if (action === 'join') {
                const game = await WordFuddleManager.joinGame(messageId, interaction.user.id);

                const embed = WordFuddleManager.getGameEmbed(game, interaction.client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.reply({
                    content: `${interaction.user} has joined the game!`,
                    ephemeral: true
                });

                await interaction.message.edit({ embeds: [embed], components });
            }
            else if (action === 'start') {
                const game = await WordFuddleManager.startGame(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, interaction.client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.update({ embeds: [embed], components });
            }
            else if (action === 'hint') {
                const game = await WordFuddleManager.giveHint(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, interaction.client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.reply({
                    content: 'Here\'s a hint!',
                    ephemeral: true
                });

                await interaction.message.edit({ embeds: [embed], components });
            }
            else if (action === 'skip') {
                const game = await WordFuddleManager.skipWord(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, interaction.client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.update({ embeds: [embed], components });
            }
            else if (action === 'next') {
                const game = await WordFuddleManager.nextRound(messageId);

                const embed = WordFuddleManager.getGameEmbed(game, interaction.client);
                const components = WordFuddleManager.getGameComponents(game, interaction.user.id);

                await interaction.update({ embeds: [embed], components });
            }
        } catch (error) {
            console.error('WordFuddle interaction error:', error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ Error: ${error.message}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ Error: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    },

    // This will be called by the messageCreate handler
    async handleMessage(message) {
        // Only process messages that are not from bots and are in a guild
        if (message.author.bot || !message.guild) return;

        try {
            // Find an active game in this channel
            const game = await WordFuddleGame.findOne({
                channelId: message.channelId,
                status: 'playing'
            });

            if (!game) return;

            // Check if the message is a guess
            const guess = message.content.trim().toLowerCase();
            const result = await game.makeGuess(message.author.id, guess);

            if (result.correct) {
                const points = result.score;
                const user = message.client.users.cache.get(message.author.id);

                // Delete the guess message to keep the channel clean
                await message.delete().catch(console.error);

                // Send a success message
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setDescription(`🎉 ${user} guessed the word **${game.currentWord.original}** and earned ${points} points!`);

                await message.channel.send({ embeds: [embed] });

                // Update the game message
                const gameEmbed = WordFuddleManager.getGameEmbed(game, message.client);
                const components = WordFuddleManager.getGameComponents(game, message.author.id);

                await message.channel.messages.fetch(game.messageId)
                    .then(msg => msg.edit({ embeds: [gameEmbed], components }))
                    .catch(console.error);

                // If the game is over, don't start a new round immediately
                if (game.status === 'finished') return;

                // Start a new round after a short delay
                setTimeout(async () => {
                    try {
                        const updatedGame = await WordFuddleGame.findById(game._id);
                        if (updatedGame.status !== 'playing') {
                            await updatedGame.newRound();

                            const newEmbed = WordFuddleManager.getGameEmbed(updatedGame, message.client);
                            const newComponents = WordFuddleManager.getGameComponents(updatedGame, message.author.id);

                            await message.channel.messages.fetch(updatedGame.messageId)
                                .then(msg => msg.edit({ embeds: [newEmbed], components: newComponents }))
                                .catch(console.error);
                        }
                    } catch (error) {
                        console.error('Error starting new round:', error);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Error handling message in WordFuddle:', error);
        }
    }
};
