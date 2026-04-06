const { Events } = require('discord.js');
const WordFuddleGame = require('../../Models/Games/WordFuddleGame');
const WordFuddleManager = require('../../Utils/Games/WordFuddleManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('wordfuddle_')) return;

        const [_, action, messageId] = interaction.customId.split('_');

        try {
            const game = await WordFuddleGame.findOne({ messageId });
            if (!game) {
                return interaction.reply({
                    content: 'Game not found or expired.',
                    ephemeral: true
                });
            }

            if (action === 'join') {
                await interaction.deferUpdate();
                await WordFuddleManager.joinGame(messageId, interaction.user.id);

                const updatedGame = await WordFuddleGame.findById(game._id);
                const embed = WordFuddleManager.getGameEmbed(updatedGame, interaction.client);
                const components = WordFuddleManager.getGameComponents(updatedGame, interaction.user.id);

                await interaction.editReply({
                    content: `${interaction.user} has joined the game!`,
                    embeds: [embed],
                    components
                });
            }
            else if (action === 'start') {
                await interaction.deferUpdate();
                const updatedGame = await WordFuddleManager.startGame(messageId);

                const embed = WordFuddleManager.getGameEmbed(updatedGame, interaction.client);
                const components = WordFuddleManager.getGameComponents(updatedGame, interaction.user.id);

                await interaction.editReply({ embeds: [embed], components });
            }
            else if (action === 'hint') {
                const updatedGame = await WordFuddleManager.giveHint(messageId);

                const embed = WordFuddleManager.getGameEmbed(updatedGame, interaction.client);
                const components = WordFuddleManager.getGameComponents(updatedGame, interaction.user.id);

                await interaction.update({ embeds: [embed], components });

                await interaction.followUp({
                    content: `Here's a hint: ${updatedGame.getHint()}`,
                    ephemeral: true
                });
            }
            else if (action === 'skip') {
                await interaction.deferUpdate();
                const updatedGame = await WordFuddleManager.skipWord(messageId);

                const embed = WordFuddleManager.getGameEmbed(updatedGame, interaction.client);
                const components = WordFuddleManager.getGameComponents(updatedGame, interaction.user.id);

                await interaction.editReply({ embeds: [embed], components });
            }
            else if (action === 'next') {
                await interaction.deferUpdate();
                const updatedGame = await WordFuddleManager.nextRound(messageId);

                const embed = WordFuddleManager.getGameEmbed(updatedGame, interaction.client);
                const components = WordFuddleManager.getGameComponents(updatedGame, interaction.user.id);

                await interaction.editReply({ embeds: [embed], components });
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
};
