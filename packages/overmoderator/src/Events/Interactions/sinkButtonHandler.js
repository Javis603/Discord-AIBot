const { MessageFlags } = require('discord.js');
const { applyAction, makeEmbed, makeComponents } = require('../../Games/Sink/game');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (typeof interaction.customId !== 'string') return;
        if (!interaction.customId.startsWith('sink:')) return;

        const games = client.games;
        if (!games) {
            return interaction.reply({ content: 'No game state found.', flags: MessageFlags.Ephemeral });
        }

        const game = games.get(interaction.channelId);
        if (!game || game.gameType !== 'sink') {
            return interaction.reply({ content: 'No Sink game is running in this channel.', flags: MessageFlags.Ephemeral });
        }

        const action = interaction.customId.split(':')[1];
        const { error } = applyAction(game, action, interaction.user.id);

        if (error) {
            return interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        }

        games.set(interaction.channelId, game);

        const embed = makeEmbed(game, client);
        const components = makeComponents(game);

        await interaction.update({ embeds: [embed], components }).catch(async () => {
            await interaction.reply({ content: 'Failed to update game message.', flags: MessageFlags.Ephemeral }).catch(() => { });
        });
    }
};
