import { TextChannel, User, EmbedBuilder } from 'discord.js';

export interface Player {
  userId: string;
  username: string;
  score: number;
  birdsLeft: number;
  currentTurn: boolean;
}

export interface Game {
  channelId: string;
  players: Map<string, Player>;
  currentPlayerIndex: number;
  isActive: boolean;
  level: number;
  structures: Structure[];
  pigs: Pig[];
  currentBird: Bird | null;
}

export interface Structure {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wood' | 'stone' | 'ice';
  health: number;
}

export interface Pig {
  id: number;
  x: number;
  y: number;
  health: number;
  points: number;
}

export interface Bird {
  type: 'red' | 'blue' | 'yellow' | 'black' | 'white';
  x: number;
  y: number;
  velocity: { x: number; y: number };
  launched: boolean;
}

export class GameManager {
  private games: Map<string, Game> = new Map();
  private playerStats: Map<string, { totalScore: number; gamesPlayed: number }> = new Map();

  createGame(channelId: string, creator: User): boolean {
    if (this.games.has(channelId)) {
      return false;
    }

    const game: Game = {
      channelId,
      players: new Map(),
      currentPlayerIndex: 0,
      isActive: true,
      level: 1,
      structures: [],
      pigs: [],
      currentBird: null
    };

    this.games.set(channelId, game);
    return true;
  }

  addPlayer(channelId: string, user: User): boolean {
    const game = this.games.get(channelId);
    if (!game || !game.isActive) return false;

    if (game.players.has(user.id)) return false;

    game.players.set(user.id, {
      userId: user.id,
      username: user.username,
      score: 0,
      birdsLeft: 5, // Each player gets 5 birds per turn
      currentTurn: game.players.size === 0 // First player starts
    });

    return true;
  }

  async startGame(channel: TextChannel, level = 1): Promise<boolean> {
    const game = this.games.get(channel.id);
    if (!game || !game.isActive) return false;

    game.level = level;
    game.structures = this.generateStructures(level);
    game.pigs = this.generatePigs(level);
    
    // Set first player's turn
    const firstPlayerId = Array.from(game.players.keys())[0];
    game.players.get(firstPlayerId)!.currentTurn = true;

    await this.sendGameState(channel, game);
    return true;
  }

  private generateStructures(level: number): Structure[] {
    // Generate random structures based on level
    const structures: Structure[] = [];
    const structureCount = 3 + Math.floor(level / 2);
    
    for (let i = 0; i < structureCount; i++) {
      structures.push({
        x: 500 + Math.random() * 200,
        y: 300 + (i * 100) % 300,
        width: 50 + Math.random() * 50,
        height: 50 + Math.random() * 50,
        type: ['wood', 'stone', 'ice'][Math.floor(Math.random() * 3)] as 'wood' | 'stone' | 'ice',
        health: 100
      });
    }
    
    return structures;
  }

  private generatePigs(level: number): Pig[] {
    const pigs: Pig[] = [];
    const pigCount = Math.min(3 + level, 10);
    
    for (let i = 0; i < pigCount; i++) {
      pigs.push({
        id: i,
        x: 600 + (i % 3) * 100,
        y: 400 - Math.floor(i / 3) * 100,
        health: 1,
        points: 1000
      });
    }
    
    return pigs;
  }

  async launchBird(channelId: string, userId: string, angle: number, power: number): Promise<string | null> {
    const game = this.games.get(channelId);
    if (!game || !game.isActive) return 'No active game!';

    const player = game.players.get(userId);
    if (!player || !player.currentTurn || player.birdsLeft <= 0) {
      return 'Not your turn or no birds left!';
    }

    if (game.currentBird) {
      return 'A bird is already in the air!';
    }

    // Create new bird
    game.currentBird = {
      type: 'red', // Start with basic red bird
      x: 100,
      y: 400,
      velocity: {
        x: Math.cos(angle) * power * 10,
        y: -Math.sin(angle) * power * 10
      },
      launched: false
    };

    player.birdsLeft--;
    return null;
  }

  private async sendGameState(channel: TextChannel, game: Game) {
    const currentPlayer = Array.from(game.players.values()).find(p => p.currentTurn);
    
    const embed = new EmbedBuilder()
      .setTitle(`🐦 ANGRY BIRDS - Level ${game.level} 🐦`)
      .setDescription(
        `**Current Turn:** ${currentPlayer?.username || 'No one'} (${currentPlayer?.birdsLeft} birds left)\n` +
        `**Pigs Remaining:** ${game.pigs.length}\n` +
        `**Structures:** ${game.structures.length}\n\n` +
        `Use \`/launch <angle> <power>\` to launch your bird!`
      )
      .setColor('#FFA500')
      .setFooter({ text: 'Angry Birds Discord - Destroy all pigs to win!' })
      .setTimestamp();

    // Add player scores
    const scores = Array.from(game.players.values())
      .sort((a, b) => b.score - a.score)
      .map(p => `${p.username}: ${p.score} points`)
      .join('\n');
    
    embed.addFields({
      name: '📊 Scores',
      value: scores || 'No scores yet',
      inline: true
    });

    await channel.send({ embeds: [embed] });
  }

  async endTurn(channelId: string, userId: string): Promise<boolean> {
    const game = this.games.get(channelId);
    if (!game || !game.isActive) return false;

    const player = game.players.get(userId);
    if (!player || !player.currentTurn) return false;

    // Switch to next player
    const playerIds = Array.from(game.players.keys());
    const currentIndex = playerIds.indexOf(userId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    
    player.currentTurn = false;
    const nextPlayer = game.players.get(playerIds[nextIndex]);
    if (nextPlayer) {
      nextPlayer.currentTurn = true;
      nextPlayer.birdsLeft = 5; // Reset birds for next player
    }

    return true;
  }

  getGame(channelId: string): Game | undefined {
    return this.games.get(channelId);
  }

  getPlayerStats(userId: string) {
    return this.playerStats.get(userId);
  }
}
