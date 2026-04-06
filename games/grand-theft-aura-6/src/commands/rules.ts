import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { GameManager } from '../game/GameManager';

export const rulesCommand = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('📜 View the rules for Grand Theft Aura 6'),

  async execute(interaction: ChatInputCommandInteraction, gameManager: GameManager) {
    const embed = new EmbedBuilder()
      .setTitle('🔪 GRAND THEFT AURA 6: SLASHER MODE 🔪')
      .setDescription(
        `**WELCOME TO SAN ANDREAS' DARKEST NIGHTMARE**\n\n` +
        `A horror-parody game inspired by GTA's legendary streets, where one player becomes a brutal slasher, and the rest must survive the night!\n\n` +
        `**🎮 HOW TO PLAY:**\n\n` +
        `**SETUP:**\n` +
        `1️⃣ Use \`/join\` to enter the game\n` +
        `2️⃣ Wait for at least 2 players\n` +
        `3️⃣ Use \`/startgame\` to begin\n` +
        `4️⃣ One random player becomes THE SLASHER\n\n` +
        `**GAMEPLAY:**\n` +
        `🔪 **THE SLASHER** must eliminate all players within the time limit\n` +
        `🏃 **THE HUNTED** must survive for 3 minutes to win\n` +
        `⚡ Use \`/attack @user\` to eliminate players (Slasher only in Round 1)\n` +
        `🛡️ Use \`/hide\` to temporarily protect yourself\n\n` +
        `**💫 AURA SYSTEM:**\n` +
        `Your **Aura** is your reputation, your power, your legacy!\n\n` +
        `✅ **Gain Aura:**\n` +
        `• Kill a player: **+500 Aura**\n` +
        `• Survive the round: **+200 Aura**\n` +
        `• Win as Slasher: **+1000 Aura**\n\n` +
        `❌ **Lose Aura:**\n` +
        `• Get eliminated: **-300 Aura**\n` +
        `• Lose as Slasher: **-500 Aura**\n\n` +
        `**🏆 WINNING:**\n` +
        `• **Slasher Wins:** Eliminate all hunted players\n` +
        `• **Hunted Win:** Survive until time runs out\n` +
        `• Check leaderboards with \`/stats\`\n\n` +
        `**🎭 PARODY ELEMENTS:**\n` +
        `This is a satirical homage to GTA's chaotic streets mixed with classic slasher horror tropes. Expect dark humor, dramatic deaths, and over-the-top action!\n\n` +
        `*"In the streets of San Andreas, only your aura survives..."*`
      )
      .setColor('#8B0000')
      .setFooter({ text: 'Grand Theft Aura 6 | Parody Horror Game' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
