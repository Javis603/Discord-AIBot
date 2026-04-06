const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GameSession = require('../../Models/GameSession');
const { generateGameEmbed } = require('../../Games/MGD/embedGenerator');
const { moveEnemies, checkDetection } = require('../../Games/MGD/enemyAI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mgd')
        .setDescription('Play Metal Gear Discord!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Starts a new game of Metal Gear Discord'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move in a direction')
                .addStringOption(option =>
                    option.setName('direction')
                        .setDescription('The direction to move (north, south, east, west)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'North', value: 'north' },
                            { name: 'South', value: 'south' },
                            { name: 'East', value: 'east' },
                            { name: 'West', value: 'west' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('look')
                .setDescription('Look around your current location'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hide')
                .setDescription('Attempt to hide from enemies'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('inventory')
                .setDescription('View your inventory'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('use')
                .setDescription('Use an item from your inventory')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('The item to use')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('attack')
                .setDescription('Attack the enemy'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('flee')
                .setDescription('Attempt to flee from combat'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Resets your current game of Metal Gear Discord')),
    async execute(interaction) {
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;
        let replyContent = { content: '', embeds: [] };

        if (interaction.options.getSubcommand() === 'start') {
            let session = await GameSession.findOne({ userId });

            if (session) {
                await interaction.reply('You already have a game in progress! Use `/mgd look` to see your current status or `/mgd reset` to start a new game.');
            } else {
                session = new GameSession({
                    userId,
                    channelId,
                    playerLocation: { x: 0, y: 0 }, // Starting location
                    playerInventory: ['ration', 'cardboard box'],
                    mapState: [ // Simple 3x3 map for demonstration
                        ['.', '.', '.'],
                        ['.', 'P', '.'],
                        ['.', '.', '.']
                    ],
                    enemyPositions: [{ x: 2, y: 2, direction: 'south', patrolPath: [{ x: 2, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 0 }], visionRange: 2 }],
                });
                await session.save();
                const gameEmbed = generateGameEmbed(session);
                await interaction.reply({ embeds: [gameEmbed] });
            }
        } else if (interaction.options.getSubcommand() === 'move') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }

            const direction = interaction.options.getString('direction');
            let newX = session.playerLocation.x;
            let newY = session.playerLocation.y;

            switch (direction) {
                case 'north':
                    newY--;
                    break;
                case 'south':
                    newY++;
                    break;
                case 'east':
                    newX++;
                    break;
                case 'west':
                    newX--;
                    break;
            }

            // Simple boundary check for a 3x3 map
            const mapWidth = session.mapState[0].length;
            const mapHeight = session.mapState.length;

            if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight) {
                replyContent.content = 'You cannot move in that direction, you are at the edge of the map!';
                const gameEmbed = generateGameEmbed(session);
                replyContent.embeds = [gameEmbed];
                return interaction.reply(replyContent);
            }

            session.playerLocation.x = newX;
            session.playerLocation.y = newY;

            // Enemy AI turn
            const updatedSessionAfterEnemyMove = moveEnemies(session); // moveEnemies now returns the updated session
            const detected = checkDetection(updatedSessionAfterEnemyMove);
            
            if (detected && !updatedSessionAfterEnemyMove.inCombat) {
                updatedSessionAfterEnemyMove.inCombat = true;
                updatedSessionAfterEnemyMove.currentEnemy = updatedSessionAfterEnemyMove.enemyPositions.findIndex(e =>
                    Math.abs(updatedSessionAfterEnemyMove.playerLocation.x - e.x) <= e.visionRange &&
                    Math.abs(updatedSessionAfterEnemyMove.playerLocation.y - e.y) <= e.visionRange
                );
                updatedSessionAfterEnemyMove.enemyHealth = updatedSessionAfterEnemyMove.enemyPositions.map(() => 100); // All enemies start with 100 health
                updatedSessionAfterEnemyMove.turnOrder = 'player';
                replyContent.content = 'You have been spotted! Prepare for combat!';
            } else if (!detected && updatedSessionAfterEnemyMove.inCombat) {
                updatedSessionAfterEnemyMove.inCombat = false;
                updatedSessionAfterEnemyMove.currentEnemy = -1;
                updatedSessionAfterEnemyMove.enemyHealth = [];
                updatedSessionAfterEnemyMove.turnOrder = 'player';
                replyContent.content = 'You managed to escape combat!';
            } else if (detected && updatedSessionAfterEnemyMove.inCombat) {
                // Already in combat, continue combat
                replyContent.content = 'Combat continues!';
            } else {
                replyContent.content = 'You moved safely.';
            }

            await updatedSessionAfterEnemyMove.save();

            const gameEmbed = generateGameEmbed(updatedSessionAfterEnemyMove);
            replyContent.embeds = [gameEmbed];
            await interaction.reply(replyContent);
        } else if (interaction.options.getSubcommand() === 'look') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }
            const gameEmbed = generateGameEmbed(session);
            await interaction.reply({ embeds: [gameEmbed] });
        } else if (interaction.options.getSubcommand() === 'hide') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }

            // Reduce detection level, maybe based on a random chance or a fixed amount
            session.detectionLevel = Math.max(0, session.detectionLevel - 20);
            replyContent.content = 'You attempt to hide... your detection level has decreased!';
            await session.save();
            const gameEmbed = generateGameEmbed(session);
            replyContent.embeds = [gameEmbed];
            await interaction.reply(replyContent);
        } else if (interaction.options.getSubcommand() === 'inventory') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }

            const inventoryEmbed = new EmbedBuilder()
                .setTitle('Your Inventory')
                .setDescription(session.playerInventory.length > 0 ? session.playerInventory.join(', ') : 'Your inventory is empty.')
                .setColor('Blue');

            await interaction.reply({ embeds: [inventoryEmbed] });
        } else if (interaction.options.getSubcommand() === 'use') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }

            const itemToUse = interaction.options.getString('item').toLowerCase();

            if (!session.playerInventory.includes(itemToUse)) {
                return interaction.reply(`You don't have a "${itemToUse}" in your inventory.`);
            }

            let replyMessage = '';
            switch (itemToUse) {
                case 'ration':
                    session.playerHealth = Math.min(100, session.playerHealth + 20);
                    session.playerInventory = session.playerInventory.filter(item => item !== 'ration');
                    replyMessage = 'You consumed a ration and recovered some health!';
                    break;
                case 'cardboard box':
                    session.detectionLevel = Math.max(0, session.detectionLevel - 50); // Reduce detection
                    replyMessage = 'You hid inside a cardboard box. Your detection level has decreased!';
                    break;
                default:
                    replyMessage = `You tried to use the "${itemToUse}", but nothing happened.`;
                    break;
            }

            await session.save();
            const gameEmbed = generateGameEmbed(session);
            await interaction.reply({ content: replyMessage, embeds: [gameEmbed] });
        } else if (interaction.options.getSubcommand() === 'attack') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }
            if (!session.inCombat || session.turnOrder !== 'player') {
                return interaction.reply('You can only attack during your turn in combat!');
            }

            const enemyIndex = session.currentEnemy;
            const enemy = session.enemyPositions[enemyIndex];

            // Simple damage calculation
            const damage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
            session.enemyHealth[enemyIndex] = Math.max(0, session.enemyHealth[enemyIndex] - damage);

            let replyMessage = `You attacked the enemy, dealing ${damage} damage!`;

            if (session.enemyHealth[enemyIndex] <= 0) {
                replyMessage += ` The enemy has been defeated!`;
                session.enemyPositions.splice(enemyIndex, 1); // Remove defeated enemy
                session.enemyHealth.splice(enemyIndex, 1);
                session.currentEnemy = -1; // No current enemy
                session.inCombat = false; // End combat for now
            } else {
                session.turnOrder = 'enemy'; // Switch to enemy turn
            }

            await session.save();
            const gameEmbed = generateGameEmbed(session);
            await interaction.reply({ content: replyMessage, embeds: [gameEmbed] });
        } else if (interaction.options.getSubcommand() === 'flee') {
            const session = await GameSession.findOne({ userId });
            if (!session) {
                return interaction.reply('You don\'t have an active game. Start one with `/mgd start`!');
            }
            if (!session.inCombat) {
                return interaction.reply('You can only flee when in combat!');
            }

            // 50% chance to flee
            const fledSuccessfully = Math.random() < 0.5;

            if (fledSuccessfully) {
                session.inCombat = false;
                session.currentEnemy = -1;
                session.enemyHealth = [];
                session.turnOrder = 'player';
                replyContent.content = 'You successfully fled from combat!';
            } else {
                replyContent.content = 'You failed to flee! The enemy attacks!';
                // Optionally, trigger an immediate enemy attack or increase detection
                session.turnOrder = 'enemy'; // Enemy's turn if flee fails
            }
            await session.save();
            const gameEmbed = generateGameEmbed(session);
            replyContent.embeds = [gameEmbed];
            await interaction.reply(replyContent);
        } else if (interaction.options.getSubcommand() === 'reset') {
            const session = await GameSession.findOneAndDelete({ userId });
            if (session) {
                await interaction.reply('Your Metal Gear Discord game has been reset!');
            } else {
                await interaction.reply('You don\'t have an active game to reset.');
            }
        }
    },
};