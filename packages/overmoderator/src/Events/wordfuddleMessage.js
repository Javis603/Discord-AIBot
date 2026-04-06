const { Events } = require('discord.js');
const WordFuddleGame = require('../Models/Games/WordFuddleGame');
const WordFuddleManager = require('../Utils/Games/WordFuddleManager');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages and DMs
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
                const user = message.client.users.cache.get(message.author.id) || { toString: () => 'Unknown User' };

                // Delete the guess message to keep the channel clean
                await message.delete().catch(console.error);

                // Send a success message
                const { EmbedBuilder } = require('discord.js');
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
            console.error('Error in wordfuddleMessage handler:', error);
        }
    },
};
