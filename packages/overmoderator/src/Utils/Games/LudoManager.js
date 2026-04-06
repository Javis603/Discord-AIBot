const LudoGame = require('../../Models/Games/LudoGame');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class LudoManager {
  static async createGame(channelId, guildId, userId) {
    return LudoGame.createNewGame(channelId, guildId, userId);
  }

  static async joinGame(gameId, userId, color) {
    const game = await LudoGame.findById(gameId);
    if (!game) throw new Error('Game not found');
    return game.addPlayer(userId, color);
  }

  static async startGame(gameId) {
    const game = await LudoGame.findById(gameId);
    if (!game) throw new Error('Game not found');
    return game.startGame();
  }

  static async rollDice(gameId, userId) {
    const game = await LudoGame.findById(gameId);
    if (!game) throw new Error('Game not found');
    
    const playerIndex = game.players.findIndex(p => p.userId === userId);
    if (playerIndex !== game.currentPlayer) {
      throw new Error('Not your turn');
    }
    
    await game.rollDice();
    return game;
  }

  static async makeMove(gameId, userId, pieceIndex) {
    const game = await LudoGame.findById(gameId);
    if (!game) throw new Error('Game not found');
    
    const playerIndex = game.players.findIndex(p => p.userId === userId);
    if (playerIndex !== game.currentPlayer) {
      throw new Error('Not your turn');
    }
    
    return game.movePiece(playerIndex, pieceIndex);
  }

  static getGameEmbed(game, client) {
    const embed = new EmbedBuilder()
      .setTitle('🎲 Ludo Game')
      .setColor('#3498db')
      .setTimestamp();

    if (game.status === 'waiting') {
      embed.setDescription('Waiting for players to join...');
      embed.addFields({
        name: 'Players',
        value: game.players.map(p => `<@${p.userId}> (${p.color})`).join('\n') || 'No players yet'
      });
    } else if (game.status === 'playing') {
      const currentPlayer = game.players[game.currentPlayer];
      embed.setDescription(`🎲 **${game.diceValue || 'Roll the dice!'}**\n\n` +
        `Current turn: <@${currentPlayer.userId}> (${currentPlayer.color})`);

      // Add player boards
      game.players.forEach(player => {
        const pieces = player.pieces.map((p, i) => 
          p.isHome ? '🏠' : p.isFinished ? '✅' : '🔵'
        ).join(' ');
        
        embed.addFields({
          name: `<@${player.userId}> (${player.color})`,
          value: pieces,
          inline: true
        });
      });
    } else if (game.status === 'finished') {
      embed.setDescription(`🎉 Game Over!\n\n🏆 Winner: <@${game.winner}>`);
    }

    return embed;
  }

  static getGameComponents(game, userId) {
    if (game.status !== 'playing') return [];

    const currentPlayer = game.players[game.currentPlayer];
    if (currentPlayer.userId !== userId) {
      return []; // Not this user's turn
    }

    const components = [];
    
    if (!game.diceValue) {
      // Roll dice button
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ludo_roll_${game._id}`)
            .setLabel('🎲 Roll Dice')
            .setStyle(ButtonStyle.Primary)
        )
      );
    } else {
      // Piece selection buttons
      const row = new ActionRowBuilder();
      currentPlayer.pieces.forEach((piece, index) => {
        if (piece.isFinished) return;
        
        const label = piece.isHome ? '🏠' : '🔵';
        const style = piece.isHome && game.diceValue !== 6 
          ? ButtonStyle.Secondary 
          : ButtonStyle.Success;
          
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ludo_move_${game._id}_${index}`)
            .setLabel(label)
            .setStyle(style)
            .setDisabled(piece.isHome && game.diceValue !== 6)
        );
      });
      components.push(row);
    }

    return components;
  }
}

module.exports = LudoManager;
