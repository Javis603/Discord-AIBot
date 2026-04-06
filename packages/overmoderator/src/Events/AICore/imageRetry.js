/**
 * @file imageRetry.js
 * @description image retry event
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { 
  generateImage, 
  createEmbed, 
  createButtons,
  createStyleMenu,
  SIZES,
  STYLES,
  MessageFlags
} = require('../../Commands/AI/imagine.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction) {
    const validInteractions = ['regenerate', 'change_style', 'style_select'];
    if (
      (!interaction.isButton() || !validInteractions.includes(interaction.customId)) && 
      (!interaction.isStringSelectMenu() || interaction.customId !== 'style_select')
    ) return;
    
    const embed = interaction.message.embeds[0];
    if (!embed?.description?.includes('提示詞:')) return;

    await interaction.deferUpdate();

    try {
      const promptMatch = embed.description.match(/提示詞: (.*)\n/);
      const sizeMatch = embed.description.match(/尺寸: (.*)\n/);
      const styleMatch = embed.description.match(/風格: (.*)/);

      if (!promptMatch || !sizeMatch) {
        throw new Error('無法獲取原始生成資訊');
      }

      const prompt = promptMatch[1].trim();
      const sizeDisplay = sizeMatch[1].trim();
      const size = sizeDisplay.match(/(\d+×\d+)/)[1].replace('×', 'x');
      
      if (interaction.isButton()) {
        switch (interaction.customId) {
          case 'regenerate':
            const currentStyle = styleMatch ? 
              Object.keys(STYLES).find(key => STYLES[key].name === styleMatch[1].trim()) : '';
            await handleRegenerate(interaction, prompt, size, currentStyle, sizeDisplay);
            break;
            
          case 'change_style':
            await interaction.editReply({
              components: [createButtons(), createStyleMenu()]
            });
            break;
        }
      } 
      else if (interaction.isStringSelectMenu() && interaction.customId === 'style_select') {
        const newStyle = interaction.values[0];
        await handleRegenerate(interaction, prompt, size, newStyle, sizeDisplay);
      }

    } catch (error) {
      console.error('操作錯誤:', error);
      await interaction.editReply({
        content: `❌ 操作失敗: ${error.message || '未知錯誤'}`,
        components: [createButtons()] // 確保按鈕仍然可用
      });
    }
  }
};

async function handleRegenerate(interaction, prompt, size, style, sizeDisplay) {
  try {
    const loadingMessage = await interaction.followUp({
      content: style ? 
        `🎨 正在以 ${STYLES[style]?.name || '預設'} 風格重新生成圖片...` :
        '🎨 正在重新生成圖片...',
      fetchReply: true
    });

    await interaction.editReply({
      components: [
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('regenerate')
              .setLabel('🔄 重新生成')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('change_style')
              .setLabel('🎨 切換風格')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          )
      ]
    });

    const result = await generateImage(prompt, size, style);
    const newImageUrl = result.data[0].url;
    const newEmbed = createEmbed(prompt, newImageUrl, interaction, sizeDisplay, style);
    
    await loadingMessage.edit({
      content: style ? '✨ 已使用新風格重新生成！' : '✨ 圖像重新生成成功！',
      embeds: [newEmbed],
      components: [createButtons()]
    });

    await interaction.editReply({
      components: [createButtons()]
    });

  } catch (error) {
    console.error('重新生成錯誤:', error);
    
    await interaction.editReply({
      components: [createButtons()]
    });

    await interaction.followUp({
      content: `❌ 重新生成失敗: ${error.message || '未知錯誤'}`,
      flags: MessageFlags.Ephemeral
    });
  }
}