const { EmbedBuilder } = require('discord.js');

function generateGameEmbed(session) {
    const mapDisplay = session.mapState.map((row, y) =>
        row.map((cell, x) => {
            if (session.playerLocation.x === x && session.playerLocation.y === y) {
                return '🐍'; // Player icon
            }
            const enemy = session.enemyPositions.find(e => e.x === x && e.y === y);
            if (enemy) {
                return '🪖'; // Enemy icon
            }
            return cell;
        }).join('')
    ).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('Metal Gear Discord: Shadow Moses Incident')
        .setDescription(`**Mission:** ${session.currentMission}`)
        .addFields(
            { name: 'Location', value: `(${session.playerLocation.x}, ${session.playerLocation.y})`, inline: true },
            { name: 'Health', value: `${session.playerHealth}%`, inline: true },
            { name: 'Detection', value: `${session.detectionLevel}%`, inline: true },
            { name: 'Inventory', value: session.playerInventory.length > 0 ? session.playerInventory.join(', ') : 'Empty', inline: false },
            { name: 'Map', value: `\`\`\`\n${mapDisplay}\n\`\`\``, inline: false }
        )
        .setColor('DarkGreen')
        .setTimestamp();

    if (session.inCombat) {
        const currentEnemy = session.enemyPositions[session.currentEnemy];
        embed.addFields(
            { name: 'Combat Status', value: 'In Combat!', inline: false },
            { name: 'Enemy Health', value: `${session.enemyHealth[session.currentEnemy]}%`, inline: true },
            { name: 'Your Turn', value: session.turnOrder === 'player' ? 'Yes' : 'No', inline: true }
        );
        embed.setColor('Red');
    }

    return embed;
}

module.exports = { generateGameEmbed };
