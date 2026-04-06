const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const WordFuddleGame = require('../../Models/Games/WordFuddleGame');

class WordFuddleManager {
    static async createGame(channelId, guildId, userId) {
        return await WordFuddleGame.createNewGame(channelId, guildId, userId);
    }

    static async joinGame(gameId, userId) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.addPlayer(userId);
    }

    static async startGame(gameId) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.startGame();
    }

    static async makeGuess(gameId, userId, guess) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.makeGuess(userId, guess);
    }

    static async giveHint(gameId) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.giveHint();
    }

    static async skipWord(gameId) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.skipWord();
    }

    static async nextRound(gameId) {
        const game = await WordFuddleGame.findById(gameId);
        if (!game) throw new Error('Game not found');

        return await game.newRound();
    }

    static getGameEmbed(game, client) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Word Fuddle')
            .setDescription('Unscramble the word to earn points!')
            .setThumbnail('https://i.imgur.com/Jm5yqJ3.png')
            .setTimestamp();

        if (game.status === 'waiting') {
            embed
                .addFields(
                    { name: 'Status', value: '🟡 Waiting for players...', inline: true },
                    { name: 'Players', value: game.players.length.toString(), inline: true },
                    { name: 'Rounds', value: `${game.maxRounds} rounds`, inline: true }
                )
                .setFooter({ text: 'Use /wordfuddle join to join the game!' });
        }
        else if (game.status === 'playing') {
            const timeLeft = Math.max(0, Math.ceil((game.roundEndsAt - new Date()) / 1000));
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            embed
                .addFields(
                    { name: 'Scrambled Word', value: `\`\`\`${game.currentWord.scrambled}\`\`\`` },
                    { name: 'Round', value: `${game.round}/${game.maxRounds}`, inline: true },
                    { name: 'Time Left', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
                    { name: 'Hint', value: game.getHint() || 'No hint available' }
                )
                .setFooter({ text: `Type your guess in the chat!` });
        }
        else if (game.status === 'round_over') {
            const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
            const leaderboard = sortedPlayers
                .map((p, i) => {
                    const user = client.users.cache.get(p.userId);
                    return `${i + 1}. ${user ? user.username : 'Unknown'}: ${p.score} points`;
                })
                .join('\n');

            embed
                .setTitle('Round Over!')
                .setDescription(`The word was: **${game.currentWord.original}**`)
                .addFields(
                    { name: 'Leaderboard', value: leaderboard || 'No players yet' },
                    { name: 'Round', value: `${game.round}/${game.maxRounds}` }
                )
                .setFooter({ text: 'Starting next round soon...' });
        }
        else if (game.status === 'finished') {
            const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
            const winner = sortedPlayers[0];
            const winnerUser = client.users.cache.get(winner.userId);

            embed
                .setTitle('🎉 Game Over! 🎉')
                .setDescription(`Congratulations ${winnerUser ? winnerUser.toString() : 'Unknown'} for winning with ${winner.score} points!`)
                .addFields(
                    {
                        name: 'Final Scores',
                        value: sortedPlayers
                            .map((p, i) => {
                                const user = client.users.cache.get(p.userId);
                                return `${i + 1}. ${user ? user.username : 'Unknown'}: ${p.score} points`;
                            })
                            .join('\n') || 'No players'
                    }
                )
                .setFooter({ text: 'Thanks for playing Word Fuddle!' });
        }

        return embed;
    }

    static getGameComponents(game, userId) {
        const row = new ActionRowBuilder();

        if (game.status === 'waiting') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wordfuddle_join_${game._id}`)
                    .setLabel('Join Game')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`wordfuddle_start_${game._id}`)
                    .setLabel('Start Game')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(game.players.length === 0 || game.players[0].userId !== userId)
            );
        }
        else if (game.status === 'playing') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wordfuddle_hint_${game._id}`)
                    .setLabel('Get Hint')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`wordfuddle_skip_${game._id}`)
                    .setLabel('Skip Word')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(game.players[0].userId !== userId) // Only game starter can skip
            );
        }
        else if (game.status === 'round_over') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`wordfuddle_next_${game._id}`)
                    .setLabel('Next Round')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(game.players[0].userId !== userId) // Only game starter can proceed
            );
        }

        return [row];
    }
}

module.exports = WordFuddleManager;
