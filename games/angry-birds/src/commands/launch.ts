import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { GameManager } from '../game/GameManager';

export const launchCommand = {
  data: new SlashCommandBuilder()
    .setName('launch')
    .setDescription('🚀 Launch your bird at the pigs!')
    .addIntegerOption(option =>
      option
        .setName('angle')
        .setDescription('Launch angle (0-90 degrees)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(90)
    )
    .addIntegerOption(option =>
      option
        .setName('power')
        .setDescription('Launch power (1-10)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction: ChatInputCommandInteraction, gameManager: GameManager) {
    const channel = interaction.channel as TextChannel;
    const angle = (interaction.options.getInteger('angle', true) * Math.PI) / 180; // Convert to radians
    const power = interaction.options.getInteger('power', true);

    const error = await gameManager.launchBird(
      channel.id,
      interaction.user.id,
      angle,
      power
    );

    if (error) {
      return interaction.reply({
        content: `⚠️ ${error}`,
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `🐦 **${interaction.user.username}** launched a bird!`,
    });

    // Simulate physics and update game state
    setTimeout(() => {
      this.simulatePhysicsAndUpdateGame(channel, gameManager);
    }, 1000);
  },

  async simulatePhysicsAndUpdateGame(channel: TextChannel, gameManager: GameManager) {
    const game = gameManager.getGame(channel.id);
    if (!game || !game.currentBird) return;

    // Simulate physics (simplified for this example)
    // In a real implementation, you'd use a physics engine like Matter.js
    const bird = game.currentBird;
    const gravity = 0.2;
    const friction = 0.99;

    // Update position
    bird.x += bird.velocity.x;
    bird.y += bird.velocity.y;
    
    // Apply gravity
    bird.velocity.y += gravity;
    
    // Apply friction
    bird.velocity.x *= friction;
    bird.velocity.y *= friction;

    // Check for collisions with structures
    for (const structure of game.structures) {
      if (this.checkCollision(bird, structure)) {
        // Handle collision
        bird.velocity.x *= -0.5;
        bird.velocity.y *= -0.5;
        structure.health -= 20;
        
        if (structure.health <= 0) {
          game.structures = game.structures.filter(s => s !== structure);
        }
      }
    }

    // Check for collisions with pigs
    for (const pig of game.pigs) {
      if (this.checkPigCollision(bird, pig)) {
        // Pig is hit!
        game.pigs = game.pigs.filter(p => p !== pig);
        
        // Award points to current player
        const currentPlayer = Array.from(game.players.values()).find(p => p.currentTurn);
        if (currentPlayer) {
          currentPlayer.score += pig.points;
        }
        
        await channel.send(`💥 Pig destroyed! +${pig.points} points!`);
      }
    }

    // Check if bird is out of bounds
    if (bird.y > 800 || bird.x > 1000) {
      game.currentBird = null;
      await channel.send('🐦💨 The bird flew away!');
      
      // Check if player has more birds
      const currentPlayer = Array.from(game.players.values()).find(p => p.currentTurn);
      if (currentPlayer && currentPlayer.birdsLeft <= 0) {
        await channel.send(`🏁 **${currentPlayer.username}** is out of birds!`);
        // End turn automatically when out of birds
        await gameManager.endTurn(channel.id, currentPlayer.userId);
      }
      
      return;
    }

    // Continue simulation
    if (Math.abs(bird.velocity.x) > 0.1 || Math.abs(bird.velocity.y) > 0.1) {
      setTimeout(() => {
        this.simulatePhysicsAndUpdateGame(channel, gameManager);
      }, 50);
    } else {
      // Bird has come to rest
      game.currentBird = null;
      await channel.send('🐦 The bird has landed!');
    }
  },

  checkCollision(bird: any, structure: any): boolean {
    // Simple AABB collision detection
    return (
      bird.x < structure.x + structure.width &&
      bird.x + 20 > structure.x &&
      bird.y < structure.y + structure.height &&
      bird.y + 20 > structure.y
    );
  },

  checkPigCollision(bird: any, pig: any): boolean {
    // Simple distance-based collision
    const dx = bird.x - pig.x;
    const dy = bird.y - pig.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 30; // Pig radius + bird radius
  },
};
