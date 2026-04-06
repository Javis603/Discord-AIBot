const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (interaction.customId !== 'risk_end_phase') return;

        const game = require('../../Commands/Game/risk.js').game;

        if (!game) {
            return interaction.reply({ content: 'No game is currently in progress.', ephemeral: true });
        }

        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player || player.id !== game.getCurrentPlayer().id) {
            return interaction.reply({ content: 'It\'s not your turn!', ephemeral: true });
        }

        const newPhase = game.nextPhase();
        let response;
        if (newPhase === 'deployment') {
            response = `Turn ended. It's now **${interaction.client.users.cache.get(game.getCurrentPlayer().id).username}**'s turn (Phase: ${game.phase}). You have ${game.getCurrentPlayer().troopsToDeploy} troops to deploy.`;
        } else {
            response = `Phase ended. It's now the ${game.phase} phase.`;
        }

        const winner = game.checkWinCondition();
        if (winner) {
            await interaction.update({ content: `**${interaction.client.users.cache.get(winner.id).username}** has conquered the world and won the game!`, embeds: [], components: [] });
            require('../../Commands/Game/risk.js').game = null; // Reset game
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Risk Game')
            .setDescription(`It's **${interaction.client.users.cache.get(game.getCurrentPlayer().id).username}**'s turn (Phase: ${game.phase}).`)
            .setColor(0x00AE86);

        for (const p of game.players) {
            const user = interaction.client.users.cache.get(p.id);
            const territories = p.territories.map(tId => {
                const territory = game.territories.get(tId);
                return `${territory.name} (${territory.troops})`;
            }).join('\n');
            embed.addFields({ name: `${user.username} (Troops to deploy: ${p.troopsToDeploy})`, value: territories || 'None' });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('risk_end_phase')
                    .setLabel('End Phase')
                    .setStyle(ButtonStyle.Primary),
            );

        await interaction.update({ content: response, embeds: [embed], components: [row] });
    },
};