/**
 * @file imagine.js
 * @description A command to generate images using Pollinations.AI.
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
require("dotenv").config();
const { 
  SlashCommandBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} = require("discord.js");
const { fetch } = globalThis;
const { getText } = require('../../Functions/i18n');

const contextObj = {
  userId: 'system',
  guildId: null,
};

const SIZES = {
  'square': { name: getText('commands.imagine.messages.square', contextObj, { default: '1024×1024 (方形)' }), value: '1024x1024' },
  'landscape': { name: getText('commands.imagine.messages.landscape', contextObj, { default: '1792×1024 (橫向)' }), value: '1792x1024' },
  'portrait': { name: getText('commands.imagine.messages.portrait', contextObj, { default: '1024×1792 (直向)' }), value: '1024x1792' }
};

const STYLES = {
  'natural': { name: getText('commands.imagine.messages.natural', contextObj, { default: '自然寫實' }), value: 'natural' },
  'anime': { name: getText('commands.imagine.messages.anime', contextObj, { default: '動漫風格' }), value: 'anime' },
  'painting': { name: getText('commands.imagine.messages.painting', contextObj, { default: '自然寫實' }), value: 'painting' },
  'pixel': { name: getText('commands.imagine.messages.pixel', contextObj, { default: '油畫風格' }), value: 'pixel' },
  'fantasy': { name: getText('commands.imagine.messages.fantasy', contextObj, { default: '奇幻風格' }), value: 'fantasy' }
};

function createButtons(contextObj) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('regenerate')
        .setLabel('🔄 ' + getText('commands.imagine.messages.regenerate', contextObj, { default: '重新生成' }).replace('🔄 ', ''))
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('change_style')
        .setLabel('🎨 ' + getText('components.buttons.changeStyle', contextObj, { default: '切換風格' }))
        .setStyle(ButtonStyle.Secondary)
    );
}

function createStyleMenu(contextObj) {
  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('style_select')
        .setPlaceholder(getText('components.selects.selectStyle', contextObj, { default: '選擇圖片風格' }))
        .addOptions(
          Object.entries(STYLES).map(([key, style]) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(style.name)
              .setValue(key)
          )
        )
    );
}

function createEmbed(prompt, imageUrl, interaction, size, style, contextObj) {
  return new EmbedBuilder()
    .setColor("DarkBlue")
    .setTitle(`${getText('commands.imagine.messages.title', contextObj, { default: 'AI 圖像生成' })}`)
    /*.setDescription(`
📝 ${getText('commands.imagine.options.prompt.name', contextObj, { default: '提示詞' })}: ${prompt}
📐 ${getText('commands.imagine.options.size.name', contextObj, { default: '尺寸' })}: ${size}
🎨 ${getText('commands.imagine.options.style.name', contextObj, { default: '風格' })}: ${style ? STYLES[style]?.name : getText('common.default', contextObj, { default: '預設' })}
    `)*/
    .addFields(
      { name: `🎯 ${getText('events.AICore.imageStyle', contextObj, { default: '風格' })}`, value: `${style ? STYLES[style]?.name : getText('common.default', contextObj, { default: '預設' })}`, inline: true },
      { name: `📏 ${getText('events.AICore.imageSize', contextObj, { default: '尺寸' })}`, value: size, inline: true },
      { name: '🔍 提示詞', value: `\`\`\`${prompt}\`\`\``, inline: false }
  )
    .setImage(imageUrl)
    .setFooter({ 
      text: `${getText('common.generatedBy', contextObj, { default: '由' })} ${interaction.user.tag} ${getText('common.generated', contextObj, { default: '生成' })} | 🔒 ${getText('common.safeMode', contextObj, { default: '安全模式' })}: ${interaction.channel.nsfw ? getText('common.off', contextObj, { default: '關閉' }) : getText('common.on', contextObj, { default: '開啟' })}`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();
}

async function waitForImage(url, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkImage = async () => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          resolve(true);
          return;
        }
      } catch (error) {
        console.log('等待圖片中...');
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('圖片生成超時'));
        return;
      }

      setTimeout(checkImage, 2000);
    };

    checkImage();
  });
}

async function generateImage(prompt, size, style = '', enhance = true, safe = true) {
  const [width, height] = size.split('x').map(Number);
  const seed = Date.now();

  let stylePrompt = prompt;
  if (style) {
    switch(style) {
      case 'anime':
        stylePrompt = `${prompt}, anime style, detailed anime drawing, high quality anime art`;
        break;
      case 'painting':
        stylePrompt = `${prompt}, oil painting style, artistic, detailed brushstrokes, masterpiece painting`;
        break;
      case 'pixel':
        stylePrompt = `${prompt}, pixel art style, 16-bit, retro game art, pixelated`;
        break;
      case 'fantasy':
        stylePrompt = `${prompt}, fantasy art style, magical, ethereal, mystical atmosphere`;
        break;
      case 'natural':
        stylePrompt = `${prompt}, photorealistic, detailed, high quality photograph`;
        break;
    }
  }

  try {
    /*
    console.log('生成圖片:', {
      提示詞: stylePrompt,
      尺寸: `${width}x${height}`,
      風格: style || '預設',
      增強: enhance,
      種子: seed
    });*/

    const encodedPrompt = encodeURIComponent(stylePrompt);
    const params = new URLSearchParams({
      width: width,
      height: height,
      seed: seed,
      model: 'flux',
      nologo: 'true',
      private: 'false',
      enhance: enhance ? 'true' : 'false',
      safe: safe.toString()
    });

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params}`;

    await waitForImage(imageUrl);

    return {
      data: [{
        url: imageUrl,
        revised_prompt: stylePrompt
      }],
      model: "flux",
      provider: "Pollinations.AI",
      created: seed
    };

  } catch (error) {
    console.error('API 錯誤:', error);
    throw new Error(`圖片生成失敗: ${error.message}`);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("使用AI生成圖片")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("描述你想生成的圖片")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("size")
        .setDescription("圖片尺寸")
        .setRequired(false)
        .addChoices(
          { name: SIZES.square.name, value: SIZES.square.value },
          { name: SIZES.landscape.name, value: SIZES.landscape.value },
          { name: SIZES.portrait.name, value: SIZES.portrait.value }
        )
    )
    .addStringOption((option) =>
      option
        .setName("style")
        .setDescription("選擇圖片風格")
        .setRequired(false)
        .addChoices(
          { name: STYLES.natural.name, value: STYLES.natural.value },
          { name: STYLES.anime.name, value: STYLES.anime.value },
          { name: STYLES.painting.name, value: STYLES.painting.value },
          { name: STYLES.pixel.name, value: STYLES.pixel.value },
          { name: STYLES.fantasy.name, value: STYLES.fantasy.value }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("enhance")
        .setDescription("是否啟用品質增強（預設開啟，關閉可加快生成速度）")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      const contextObj = {
          userId: interaction.user.id,
          guildId: interaction.guildId
      };

      await interaction.deferReply();
      
      const prompt = interaction.options.getString("prompt");
      const size = interaction.options.getString("size") || SIZES.square.value;
      const style = interaction.options.getString("style") || '';
      const enhance = interaction.options.getBoolean("enhance") ?? true;
      const safeMode = !interaction.channel.nsfw;
      
      const sizeDisplay = Object.values(SIZES).find(s => s.value === size)?.name || size;

      if (!prompt || prompt.length > 1000) {
        return await interaction.editReply({
          content: getText('commands.imagine.messages.invalidPrompt', contextObj, { default: "提示詞無效或太長（限制1000字以內）。" }),
          flags: MessageFlags.Ephemeral 
        });
      }

      await interaction.editReply({
        content: getText('commands.imagine.messages.generating', contextObj, { default: '🎨 正在生成您的圖像，請稍候...' }),
        embeds: []
      });

      try {
        const result = await generateImage(prompt, size, style, enhance, safeMode);
        const imageUrl = result.data[0].url;

        const embed = createEmbed(prompt, imageUrl, interaction, sizeDisplay, style, contextObj);
        const components = [createButtons(contextObj)];
        
        await interaction.editReply({
          content: getText('commands.imagine.messages.generated', contextObj, { prompt: prompt, default: '✨ 圖像生成成功！' }),
          embeds: [embed],
          components: components
        });

      } catch (error) {
        console.error('圖像生成錯誤:', error);
        
        if (error.message && error.message.includes('content_policy_violation')) {
          await interaction.editReply({
            content: getText('commands.imagine.messages.banned', contextObj, { default: '檢測到不適當的內容，請嘗試更適當的提示詞。' }),
            flags: MessageFlags.Ephemeral 
          });
        } else {
          throw error;
        }
      }

    } catch (error) {
      console.error('執行過程發生錯誤:', error);
      await interaction.editReply({
        content: getText('commands.imagine.messages.error', contextObj, { default: '生成圖片時發生錯誤，請稍後再試。' }),
        flags: MessageFlags.Ephemeral 
      }).catch(console.error);
    }
  },

  generateImage,
  createEmbed,
  createButtons,
  createStyleMenu,
  SIZES,
  STYLES
};
