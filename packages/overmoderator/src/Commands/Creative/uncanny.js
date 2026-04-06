const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Helper function to simulate generating uncanny images
function generateUncannyImages() {
  const scenes = [
    { text: "The book described a scene of unsettling, perpetual teatime." },
    { text: "The film gave us a jolly, whimsical party." },
    { text: "But the reality... was far more curious." }
  ];

  return scenes.map(scene => {
    const encodedText = encodeURIComponent(scene.text);
    // Using a placeholder service to generate images with our text
    return `https://placehold.co/600x400/2F3136/FFFFFF/png?text=${encodedText}`;
  });
}

// Helper function to generate complaining annotations
function generateComplainingAnnotation() {
  const complaints = [
    "They completely missed the point. It was supposed to be unnerving, not a spectacle.",
    "A mockery of the original's atmospheric dread. Utterly disappointing.",
    "Reduced to simple entertainment. The author's chilling vision is lost."
  ];
  return complaints[Math.floor(Math.random() * complaints.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uncanny')
    .setDescription('Creates a short, uncanny film about differences between a book and its movie adaptation.'),
  async execute(interaction) {
    await interaction.deferReply();

    const images = generateUncannyImages();
    const complaint = generateComplainingAnnotation();

    // Post the images sequentially to create a "short film" effect
    for (let i = 0; i < images.length; i++) {
      const embed = new EmbedBuilder()
        .setImage(images[i])
        .setColor('#FF00FF'); // A suitably "uncanny" color

      if (i === 0) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.followUp({ embeds: [embed] });
      }
    }

    // Add the final "complaining" annotation
    await interaction.followUp(complaint);
  },
};
