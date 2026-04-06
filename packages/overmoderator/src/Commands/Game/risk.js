const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Game = require('../../Games/Risk/Game');

let game = null;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('risk')
        .setDescription('Play the game of Risk!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starts a new game of Risk'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join an existing game of Risk'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Starts the game after players have joined'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deploy')
                .setDescription('Deploy troops to your territories')
                .addStringOption(option =>
                    option.setName('territory')
                        .setDescription('The territory to deploy troops to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The number of troops to deploy')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('attack')
                .setDescription('Attack an enemy territory')
                .addStringOption(option =>
                    option.setName('attacking_territory')
                        .setDescription('Your territory to attack from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('defending_territory')
                        .setDescription('The enemy territory to attack')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('troops')
                        .setDescription('Number of troops to attack with (1-3)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fortify')
                .setDescription('Move troops between your territories')
                .addStringOption(option =>
                    option.setName('source_territory')
                        .setDescription('The territory to move troops from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('destination_territory')
                        .setDescription('The territory to move troops to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('troops')
                        .setDescription('Number of troops to move')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end_phase')
                .setDescription('Ends the current phase of your turn')),
    async execute(interaction) {
        const getPlayer = (userId) => game.players.find(p => p.id === userId);

        if (interaction.options.getSubcommand() === 'start') {
            if (game) {
                return interaction.reply('A game is already in progress!');
            }
            game = new Game();
            game.addPlayer(interaction.user.id);

            await interaction.reply('A new game of Risk has been created! Type `/risk join` to join. Once all players have joined, type `/risk play` to start the game.');
        } else if (interaction.options.getSubcommand() === 'join') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }
            if (getPlayer(interaction.user.id)) {
                return interaction.reply('You have already joined this game!');
            }
            game.addPlayer(interaction.user.id);
            await interaction.reply(`${interaction.user.username} has joined the game! Current players: ${game.players.length}. Type \\\`/risk play\\\` to start the game.`);
        } else if (interaction.options.getSubcommand() === 'play') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }
            if (game.players.length < 2) {
                return interaction.reply('You need at least 2 players to start a game of Risk!');
            }
            if (game.phase !== 'setup') {
                return interaction.reply('The game has already started!');
            }

            game.setup();

            const embed = new EmbedBuilder()
                .setTitle('Risk Game Started!')
                .setDescription(`It's **${interaction.client.users.cache.get(game.getCurrentPlayer().id).username}**'s turn (Phase: ${game.phase}).`)
                .setColor(0x00AE86);

            for (const player of game.players) {
                const user = interaction.client.users.cache.get(player.id);
                const territories = player.territories.map(tId => {
                    const territory = game.territories.get(tId);
                    return `${territory.name} (${territory.troops})`;
                }).join('\n');
                embed.addFields({ name: `${user.username} (Troops to deploy: ${player.troopsToDeploy})`, value: territories || 'None' });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('risk_end_phase')
                        .setLabel('End Phase')
                        .setStyle(ButtonStyle.Primary),
                );

            await interaction.reply({ embeds: [embed], components: [row] });
        } else if (interaction.options.getSubcommand() === 'deploy') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }
            if (game.phase !== 'deployment') {
                return interaction.reply('It\'s not the deployment phase!');
            }

            const player = getPlayer(interaction.user.id);
            if (!player || player.id !== game.getCurrentPlayer().id) {
                return interaction.reply('It\'s not your turn!');
            }

            const territoryName = interaction.options.getString('territory');
            const amount = interaction.options.getInteger('amount');

            const territory = Array.from(game.territories.values()).find(t => t.name.toLowerCase() === territoryName.toLowerCase());

            if (!territory) {
                return interaction.reply(`Territory "${territoryName}" not found.`);
            }

            if (territory.owner.id !== player.id) {
                return interaction.reply(`You do not own ${territory.name}.`);
            }

            if (amount <= 0) {
                return interaction.reply('You must deploy at least 1 troop.');
            }

            if (player.troopsToDeploy < amount) {
                return interaction.reply(`You only have ${player.troopsToDeploy} troops to deploy.`);
            }

            territory.addTroops(amount);
            player.troopsToDeploy -= amount;

            await interaction.reply(`Deployed ${amount} troops to ${territory.name}. You have ${player.troopsToDeploy} troops remaining to deploy.`);
        } else if (interaction.options.getSubcommand() === 'attack') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }
            if (game.phase !== 'attack') {
                return interaction.reply('It\'s not the attack phase!');
            }

            const player = getPlayer(interaction.user.id);
            if (!player || player.id !== game.getCurrentPlayer().id) {
                return interaction.reply('It\'s not your turn!');
            }

            const attackingTerritoryName = interaction.options.getString('attacking_territory');
            const defendingTerritoryName = interaction.options.getString('defending_territory');
            const troops = interaction.options.getInteger('troops');

            const attackingTerritory = Array.from(game.territories.values()).find(t => t.name.toLowerCase() === attackingTerritoryName.toLowerCase());
            const defendingTerritory = Array.from(game.territories.values()).find(t => t.name.toLowerCase() === defendingTerritoryName.toLowerCase());

            if (!attackingTerritory) {
                return interaction.reply(`Attacking territory "${attackingTerritoryName}" not found.`);
            }
            if (!defendingTerritory) {
                return interaction.reply(`Defending territory "${defendingTerritoryName}" not found.`);
            }

            const result = game.attack(attackingTerritory.id, defendingTerritory.id, troops);
            await interaction.reply(result.message);

            const winner = game.checkWinCondition();
            if (winner) {
                await interaction.followUp(`**${interaction.client.users.cache.get(winner.id).username}** has conquered the world and won the game!`);
                game = null; // Reset game
            }
        } else if (interaction.options.getSubcommand() === 'fortify') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }
            if (game.phase !== 'fortification') {
                return interaction.reply('It\'s not the fortification phase!');
            }

            const player = getPlayer(interaction.user.id);
            if (!player || player.id !== game.getCurrentPlayer().id) {
                return interaction.reply('It\'s not your turn!');
            }

            const sourceTerritoryName = interaction.options.getString('source_territory');
            const destinationTerritoryName = interaction.options.getString('destination_territory');
            const troops = interaction.options.getInteger('troops');

            const sourceTerritory = Array.from(game.territories.values()).find(t => t.name.toLowerCase() === sourceTerritoryName.toLowerCase());
            const destinationTerritory = Array.from(game.territories.values()).find(t => t.name.toLowerCase() === destinationTerritoryName.toLowerCase());

            if (!sourceTerritory) {
                return interaction.reply(`Source territory "${sourceTerritoryName}" not found.`);
            }
            if (!destinationTerritory) {
                return interaction.reply(`Destination territory "${destinationTerritoryName}" not found.`);
            }

            const result = game.fortify(sourceTerritory.id, destinationTerritory.id, troops);
            await interaction.reply(result.message);
        } else if (interaction.options.getSubcommand() === 'end_phase') {
            if (!game) {
                return interaction.reply('No game is currently in progress. Start one with `/risk start`!');
            }

            const player = getPlayer(interaction.user.id);
            if (!player || player.id !== game.getCurrentPlayer().id) {
                return interaction.reply('It\'s not your turn!');
            }

            const newPhase = game.nextPhase();
            if (newPhase === 'deployment') {
                await interaction.reply(`Turn ended. It's now **${interaction.client.users.cache.get(game.getCurrentPlayer().id).username}**'s turn (Phase: ${game.phase}). You have ${game.getCurrentPlayer().troopsToDeploy} troops to deploy.`);
            } else {
                await interaction.reply(`Phase ended. It's now the ${game.phase} phase.`);
            }

            const winner = game.checkWinCondition();
            if (winner) {
                await interaction.followUp(`**${interaction.client.users.cache.get(winner.id).username}** has conquered the world and won the game!`);
                game = null; // Reset game
            }
        }
    },
};

module.exports.game = game;