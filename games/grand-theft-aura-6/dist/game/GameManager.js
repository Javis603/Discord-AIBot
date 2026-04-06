"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const discord_js_1 = require("discord.js");
class GameManager {
    constructor() {
        this.games = new Map();
        this.playerStats = new Map();
    }
    createGame(channelId) {
        if (this.games.has(channelId)) {
            return false;
        }
        this.games.set(channelId, {
            channelId,
            players: new Map(),
            isActive: false,
            round: 0,
            slasherId: null,
            startTime: 0,
            roundDuration: 180, // 3 minutes per round
            roundTimer: null,
        });
        return true;
    }
    addPlayer(channelId, user) {
        const game = this.games.get(channelId);
        if (!game || game.isActive)
            return false;
        if (game.players.has(user.id))
            return false;
        game.players.set(user.id, {
            userId: user.id,
            username: user.username,
            aura: 1000, // Starting aura
            isAlive: true,
            isSlasher: false,
            kills: 0,
            deaths: 0,
        });
        return true;
    }
    async startGame(channelId, channel) {
        const game = this.games.get(channelId);
        if (!game || game.isActive || game.players.size < 2)
            return false;
        game.isActive = true;
        game.round = 1;
        game.startTime = Date.now();
        // Select random slasher
        const playerIds = Array.from(game.players.keys());
        const randomSlasherId = playerIds[Math.floor(Math.random() * playerIds.length)];
        game.slasherId = randomSlasherId;
        const slasher = game.players.get(randomSlasherId);
        slasher.isSlasher = true;
        await this.sendGameStartEmbed(channel, game, slasher);
        this.startRoundTimer(channel, game);
        return true;
    }
    async sendGameStartEmbed(channel, game, slasher) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🔪 GRAND THEFT AURA 6: SLASHER MODE 🔪')
            .setDescription(`**Round ${game.round} has begun!**\n\n` +
            `👻 **THE SLASHER IS ON THE LOOSE!**\n` +
            `💀 A mysterious killer roams the streets of San Andreas...\n\n` +
            `**RULES:**\n` +
            `🎯 The Slasher must eliminate all players\n` +
            `🏃 The Hunted must survive for ${game.roundDuration} seconds\n` +
            `⚡ Use \`/attack @user\` to eliminate players\n` +
            `🛡️ Use \`/hide\` to gain temporary protection\n\n` +
            `**AURA SYSTEM:**\n` +
            `💪 Kills: +500 Aura\n` +
            `😱 Deaths: -300 Aura\n` +
            `🏆 Surviving: +200 Aura\n\n` +
            `⏰ **Time Limit: ${game.roundDuration}s**`)
            .setColor('#8B0000')
            .setFooter({ text: `Players: ${game.players.size} | Aura is everything!` })
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        // DM the slasher
        try {
            const slasherUser = await channel.guild.members.fetch(slasher.userId);
            await slasherUser.send(`🔪 **YOU ARE THE SLASHER!** Hunt down your victims before time runs out!`);
        }
        catch (error) {
            console.error('Could not DM slasher:', error);
        }
    }
    startRoundTimer(channel, game) {
        let timeLeft = game.roundDuration;
        game.roundTimer = setInterval(async () => {
            timeLeft--;
            if (timeLeft <= 0) {
                await this.endRound(channel, game, false);
            }
            else if (timeLeft === 60 || timeLeft === 30 || timeLeft === 10) {
                await channel.send(`⏰ **${timeLeft} seconds remaining!** The darkness grows...`);
            }
        }, 1000);
    }
    async attackPlayer(channelId, attackerId, targetId, channel) {
        const game = this.games.get(channelId);
        if (!game || !game.isActive)
            return 'No active game!';
        const attacker = game.players.get(attackerId);
        const target = game.players.get(targetId);
        if (!attacker || !target)
            return 'Invalid players!';
        if (!target.isAlive)
            return 'Target is already dead!';
        if (attackerId === targetId)
            return 'You cannot attack yourself!';
        // Only slasher can attack during first phase
        if (game.round === 1 && !attacker.isSlasher) {
            return 'Only the Slasher can attack during this phase!';
        }
        // Kill the target
        target.isAlive = false;
        target.deaths++;
        target.aura -= 300;
        attacker.kills++;
        attacker.aura += 500;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('💀 ELIMINATION! 💀')
            .setDescription(`**${target.username}** has been brutally eliminated!\n\n` +
            `🔪 Eliminated by: **${attacker.username}**\n` +
            `⚰️ Cause of death: Slashed in the shadows\n\n` +
            `**AURA CHANGES:**\n` +
            `📈 ${attacker.username}: +500 Aura (${attacker.aura} total)\n` +
            `📉 ${target.username}: -300 Aura (${target.aura} total)\n\n` +
            `*"Another soul lost to the streets of San Andreas..."*`)
            .setColor('#FF0000')
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        // Check if round should end
        const alivePlayers = Array.from(game.players.values()).filter(p => p.isAlive && !p.isSlasher);
        if (alivePlayers.length === 0) {
            await this.endRound(channel, game, true);
        }
        return null;
    }
    async endRound(channel, game, slasherWon) {
        if (game.roundTimer) {
            clearInterval(game.roundTimer);
            game.roundTimer = null;
        }
        game.isActive = false;
        // Award aura to survivors
        if (!slasherWon) {
            game.players.forEach(player => {
                if (player.isAlive && !player.isSlasher) {
                    player.aura += 200;
                }
            });
        }
        const leaderboard = Array.from(game.players.values())
            .sort((a, b) => b.aura - a.aura)
            .slice(0, 5);
        const leaderboardText = leaderboard
            .map((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
            const status = p.isSlasher ? '🔪 SLASHER' : p.isAlive ? '✅ ALIVE' : '💀 DEAD';
            return `${medal} **${p.username}** | ${status} | 💫 ${p.aura} Aura | K:${p.kills} D:${p.deaths}`;
        })
            .join('\n');
        const slasher = game.players.get(game.slasherId);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(slasherWon ? '🔪 THE SLASHER WINS! 🔪' : '🏆 THE HUNTED SURVIVE! 🏆')
            .setDescription(slasherWon
            ? `**${slasher.username}** has eliminated all players! Total carnage!\n\n**FINAL LEADERBOARD:**\n${leaderboardText}`
            : `The survivors outlasted the killer! **${slasher.username}** failed their mission!\n\n**FINAL LEADERBOARD:**\n${leaderboardText}`)
            .setColor(slasherWon ? '#8B0000' : '#00FF00')
            .setFooter({ text: 'GTA 6: Where your aura defines you' })
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        // Update global stats
        game.players.forEach(player => {
            const stats = this.playerStats.get(player.userId) || {
                totalKills: 0,
                totalDeaths: 0,
                totalAura: 0,
                gamesPlayed: 0,
            };
            stats.totalKills += player.kills;
            stats.totalDeaths += player.deaths;
            stats.totalAura += player.aura;
            stats.gamesPlayed += 1;
            this.playerStats.set(player.userId, stats);
        });
        // Clean up game
        this.games.delete(channel.id);
    }
    getGame(channelId) {
        return this.games.get(channelId);
    }
    getPlayerStats(userId) {
        return this.playerStats.get(userId);
    }
    getAllPlayersStats() {
        return this.playerStats;
    }
}
exports.GameManager = GameManager;
