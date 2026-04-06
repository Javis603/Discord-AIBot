const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createGame, makeEmbed, makeComponents, isCrew } = require('../../Games/Sink/game');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sink')
        .setDescription('Boat sinking simulator')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new sinking scenario')
                .addStringOption(option =>
                    option
                        .setName('difficulty')
                        .setDescription('Game difficulty')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Easy', value: 'easy' },
                            { name: 'Normal', value: 'normal' },
                            { name: 'Hard', value: 'hard' },
                        ),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join the crew in the current channel'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave the crew'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show current game status'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End the current game (captain only)'),
        ),

    async execute(interaction, client, existingGame) {
        const sub = interaction.options.getSubcommand();
        const channelId = interaction.channelId;

        if (sub === 'start') {
            if (existingGame && existingGame.gameType === 'sink' && existingGame.status === 'running') {
                return interaction.reply({
                    content: 'A Sink game is already running in this channel. Use /sink status.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const difficulty = interaction.options.getString('difficulty') || 'normal';
            const game = createGame({
                channelId,
                guildId: interaction.guildId,
                captainId: interaction.user.id,
                difficulty
            });

            const msg = await interaction.reply({
                embeds: [makeEmbed(game, client)],
                components: makeComponents(game),
                fetchReply: true
            });

            game.messageId = msg?.id || null;
            return game;
        }

        if (!existingGame || existingGame.gameType !== 'sink') {
            return interaction.reply({
                content: 'No Sink game is running in this channel. Start one with /sink start.',
                flags: MessageFlags.Ephemeral
            });
        }

        const game = existingGame;

        if (sub === 'join') {
            if (game.status !== 'running') {
                return interaction.reply({ content: 'That game has ended. Start a new one with /sink start.', flags: MessageFlags.Ephemeral });
            }
            if (isCrew(game, interaction.user.id)) {
                return interaction.reply({ content: 'You are already in the crew.', flags: MessageFlags.Ephemeral });
            }

            game.crew.push(interaction.user.id);
            game.log.push(`<@${interaction.user.id}> joins the crew.`);

            await interaction.reply({ content: 'Joined the crew.', flags: MessageFlags.Ephemeral });

            if (game.messageId && interaction.channel) {
                const message = await interaction.channel.messages.fetch(game.messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [makeEmbed(game, client)], components: makeComponents(game) }).catch(() => { });
                }
            }

            return game;
        }

        if (sub === 'leave') {
            if (!isCrew(game, interaction.user.id)) {
                return interaction.reply({ content: 'You are not in the crew.', flags: MessageFlags.Ephemeral });
            }
            if (interaction.user.id === game.captainId) {
                return interaction.reply({ content: 'The captain cannot leave. Use /sink end to end the game.', flags: MessageFlags.Ephemeral });
            }

            game.crew = game.crew.filter(id => id !== interaction.user.id);
            game.log.push(`<@${interaction.user.id}> leaves the crew.`);

            await interaction.reply({ content: 'Left the crew.', flags: MessageFlags.Ephemeral });

            if (game.messageId && interaction.channel) {
                const message = await interaction.channel.messages.fetch(game.messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [makeEmbed(game, client)], components: makeComponents(game) }).catch(() => { });
                }
            }

            return game;
        }

        if (sub === 'status') {
            return interaction.reply({
                embeds: [makeEmbed(game, client)],
                components: makeComponents(game),
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === 'end') {
            if (interaction.user.id !== game.captainId) {
                return interaction.reply({ content: 'Only the captain can end the game.', flags: MessageFlags.Ephemeral });
            }

            game.status = 'ended';
            game.log.push('The scenario is ended by the captain.');

            await interaction.reply({ content: 'Game ended.', flags: MessageFlags.Ephemeral });

            if (game.messageId && interaction.channel) {
                const message = await interaction.channel.messages.fetch(game.messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [makeEmbed(game, client)], components: makeComponents(game) }).catch(() => { });
                }
            }

            return game;
        }
    }
};
