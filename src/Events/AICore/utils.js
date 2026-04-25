/**
 * @file utils.js
 * @description Discord AI Bot utils for AI Core module, including conversation processing, PDF extraction, image generation, and search functions.
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { Client, GatewayIntentBits, Partials, Collection, TextInputStyle, AttachmentBuilder, EmbedBuilder, WebhookClient, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const yaml = require('js-yaml');
const fs = require('fs');
const axios = require('axios');
const fetch = require('node-fetch');
const PDFParser = require('pdf-parse');
const roles = yaml.load(fs.readFileSync('./roles.yaml', 'utf8'));
const { encode, encodeChat } = require('gpt-tokenizer');
const config = require('../../../config.json');
const { getText } = require('../../Functions/i18n');
const { processImageUrl } = require('../../utils/r2Uploader');
require('dotenv/config');
const OpenAI = require('openai');
const { tavily } = require("@tavily/core");

let models = JSON.parse(fs.readFileSync('./models.json', 'utf8'));
if (process.env.DEFAULT_MODEL) {
    models.default = process.env.DEFAULT_MODEL;
}

const GENERATE_IMAGE_ENABLED = process.env.GENERATE_IMAGE === 'true';
const replyChannels = process.env.REPLY_CHANNEL.split(',');

const openai = new OpenAI({
    apiKey: process.env.DEFAULT_API_KEY,
    baseURL: process.env.DEFAULT_BASE_URL
});

const { 
    specialUsers,
    modelGroups,
    getModelGroup
} = require('./models');

const UserSettings = require('../../Models/UserSettings');
const Conversation = require('../../Models/Conversation');

const MAX_TOKENS = process.env.MAX_CONTEXT_TOKENS;
const PredictionApi = process.env.BUTTON_API_KEY || process.env.DEFAULT_API_KEY;
const PredictionBase = process.env.BUTTON_BASE_URL || process.env.DEFAULT_BASE_URL;
const predictedModel = process.env.BUTTON_MODEL || process.env.DEFAULT_MODEL;
const detail = process.env.IMAGE_DETAIL;
//const temperature = 0.7;

const analysisSearchModel = process.env.ALL_FUNCTION_MODEL || process.env.DEFAULT_MODEL;
const analysisImagineModel = process.env.ALL_FUNCTION_MODEL || process.env.DEFAULT_MODEL;
const imaginePromptModel = process.env.ALL_FUNCTION_MODEL || process.env.DEFAULT_MODEL;
const summaryModel = process.env.SUMMARY_MODEL || process.env.DEFAULT_MODEL;
const deepThinkingModel = process.env.DEEP_THINKING_MODEL;

async function webhookLog(logMessage, functionName) {
    //const webhookClient = new WebhookClient({url: process.env.USAGE_LOGS});

    const m = new EmbedBuilder()
    .setAuthor({ name: `Function: ${functionName}` })
    .setDescription(logMessage || 'No message provided')
    .setFooter({ text: `你爸AI使用紀錄` })
    .setTimestamp();
    //webhookClient.send({embeds: [m] });
}

async function updateUserSettings(userId, data) {
    try {
        await UserSettings.findOneAndUpdate(
            { userId },
            data,
            { upsert: true }
        );
    } catch (error) {
        console.error('Error updating user settings:', error);
    }
}

async function getUserSettings(userId) {
    try {
        return await UserSettings.findOne({ userId });
    } catch (error) {
        console.error('Error getting user settings:', error);
        return null;
    }
}
  
function sendSplitMessages(channel, longMessage) {
  const messageLimit = 2000;

  while (longMessage.length > 0) {
      let splitIndex;
      if (longMessage.length > messageLimit) {
          splitIndex = longMessage.lastIndexOf('\n', messageLimit);
          if (splitIndex === -1 || splitIndex < messageLimit * 0.8) {
              splitIndex = messageLimit;
          }
      } else {
          splitIndex = longMessage.length;
      }

      const chunk = longMessage.substring(0, splitIndex).trim();
      channel.send(chunk);

      longMessage = longMessage.substring(splitIndex).trim();
  }
}

async function updateUserSystemPrompt(userId, message = null, client = null, roleType = null) {
    let userSettings = null;
    try {
        userSettings = await UserSettings.findOne({ userId });
    } catch (error) {
        console.error('Error fetching user settings:', error);
    }

    if (!client) {
        client = global.client;
        if (!client) {
            console.error('Client not available for updateUserSystemPrompt');
            return;
        }
    }

    if (!client.userModels) {
        client.userModels = {};
    }

    const userConfig = specialUsers[userId] || {
        role: roleType || userSettings?.model || (client.userModels[userId]?.role) || 'default',
        username: message?.member?.displayName || message?.author?.username || 'User',
        relation: specialUsers[userId]?.relation || '用戶'
    };

    if (roleType) {
        client.userModels[userId] = {
            role: roleType,
            updatedAt: new Date().toISOString()
        };
    }
    
    const webSearchStatus = client.userNetSearchEnabled.get(userId) 
    ? "開啟" 
    : "關閉，需要用戶在多功能選單裏面打開";
    
const deepThinkingStatus = client.userDeepThinkingEnabled.get(userId) 
    ? "開啟" 
    : "關閉，需要用戶在多功能選單裏面打開";
    
    const systemContent = roles[userSettings?.model || 'default']
        .replace(/{username}/g, userConfig.username)
        .replace(/{relation}/g, userConfig.relation)
        .replace(/{WebSerach}/g, webSearchStatus)
        .replace(/{DeepThinking}/g, deepThinkingStatus);

    if (!client.userConversations[userId]) {
        client.userConversations[userId] = [];
    }
    
    const systemIndex = client.userConversations[userId].findIndex(msg => msg.role === 'system');
    if (systemIndex !== -1) {
        client.userConversations[userId][systemIndex].content = systemContent;
    } else {
        client.userConversations[userId].unshift({ 
            role: 'system', 
            content: systemContent 
        });
    }

    return client.userConversations[userId];
}
  
async function generatePredictedQuestions(message, response, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };
    
  let questions = [];

  const openai = new OpenAI({
      apiKey: PredictionApi,
      baseURL: PredictionBase,
  });
  
  const predictionResponse = await openai.chat.completions.create({
      model: predictedModel,
      messages: [
          //{ role: 'system', content: '根據用戶與AI的聊天記錄，思考用戶上次詢問的場景、意圖、背景，以用戶的角度生成用戶接下來最有可能向AI（你）提出的問題。1.不要生成用戶可能已經知道答案或與當前話題無關的問題。2.始終生成用戶可能向AI提出的非常簡短清晰的問題（少於 15 個字），而不是AI向用戶提出的問題。3.切勿生成相同或相似的問題。其他要求：1.每次生成三個問題。2.必須嚴格遵從以下格式回應 {"question1": "你生成的第一個問題","question2": "你生成的第二個問題","question1": "你生成的第三個問題"}，無需輸出其他解釋。3.如果用戶的最新問題涉及創意任務（如想出一個標題），則至少給出一個問題，直接詢問如何增強AI之前答案的創意或吸引力。4.如果AI沒有回答或拒絕回答用戶的問題，則根據助手可以回答的內容生成建議，引導話題向更有成效的方向發展，而與當前話題無關。5.確保問題使用的語言與用戶和人工智能的對話一致。' },
          { role: 'system', content: getText('prompts.predictQuestions', contextObj) },
          { role: 'user', content: getText('prompts.predictQuestionsUserPrompt', contextObj, {
            userQuestion: message.content,
            aiResponse: response
        }) }
      ],
      max_tokens: 250,
  });
  //console.log(JSON.stringify(predictionResponse.choices[0], null, 2));

  try {
      const content = predictionResponse.choices[0].message.content.trim();
  
      const jsonString = content.match(/\{[\s\S]*\}/);
      if (jsonString) {
          const jsonResponse = JSON.parse(jsonString[0]);
          questions = [
              typeof jsonResponse.question1 === 'string' ? jsonResponse.question1 : '-',
              typeof jsonResponse.question2 === 'string' ? jsonResponse.question2 : '-',
              typeof jsonResponse.question3 === 'string' ? jsonResponse.question3 : '-',
          ];
      } else {
          //console.error('No JSON object found in the response.');
      }
  } catch (error) {
      //console.error('Error parsing JSON response from OpenAI:', error);
  }
  
  if (questions.length !== 3) {
      questions = [
          "-",
          "-",
          "-"
      ];
  }

  return questions;
}

async function extractSearchQuery(conversationLog, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };

    const currentDate = new Date().toISOString().split('T')[0];
    const filteredLog = conversationLog.filter(log => log.role !== 'system');
    
    try {
        const response = await openai.chat.completions.create({
            model: analysisSearchModel,
            messages: [
                {
                    role: 'system',
                    content: getText('prompts.searchAnalysis', contextObj, {
                        currentDate: currentDate
                    })
                },
                ...filteredLog
            ],
            temperature: 0.2,
            max_tokens: 150
        });

        await webhookLog(response.choices[0].message.content, "extractSearchQuery");
        const cleanedContent = response.choices[0].message.content
            .trim()
            .replace(/^```json\s*|\s*```$/g, '')
            .replace(/^`+|`+$/g, '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

            try {
                const result = JSON.parse(cleanedContent);
                
                if (!result || typeof result !== 'object' || 
                    !('needSearch' in result) ||
                    !('query' in result) || 
                    !('timeRange' in result) || 
                    !('reason' in result)) {
                    //console.log('Invalid JSON structure received:', cleanedContent);
                    return 'NO_SEARCH';
                }
    
                if (!result.needSearch || result.query === 'NO_SEARCH') {
                    return 'NO_SEARCH';
                }
    
                return {
                    query: result.query,
                    searchParams: {
                        timeRange: result.timeRange || null
                    }
                };
            } catch (error) {
                //console.error('JSON parsing error:', error);
                //console.error('Cleaned content:', cleanedContent);
                return 'NO_SEARCH';  
            }
        } catch (error) {
            console.error('API error:', error);
            return 'NO_SEARCH';
        }
}


async function searchWithTavily(searchConfig) {
    if (searchConfig === 'NO_SEARCH') {
        return { results: [], answer: '' };
    }
    
    try {
        const tvly = tavily({ 
            apiKey: process.env.TAVILY_API_KEY
        });

        const searchParams = {
            searchDepth: "advanced",
            maxResults: 10,
            includeAnswer: "advanced",
            includeImages: false,
            includeRawContent: true,
            topic: "general"
        };

        if (searchConfig.searchParams?.timeRange) {
            searchParams.timeRange = searchConfig.searchParams.timeRange;
        }

        const response = await tvly.search(searchConfig.query, searchParams);
        return { results: response.results || [], answer: response.answer || '' };
    } catch (error) {
        console.error('Tavily search error:', error);
        return { results: [], answer: '' };
    }
}

async function formatSearchResults(searchResults, answer) {
    let formattedResults = '';

    if (answer) {
        formattedResults += `💡 摘要：\n${answer}\n\n`;
    }

    if (!searchResults || searchResults.length === 0) return formattedResults;

    formattedResults += searchResults.map(result => {
        const title = result.title || '未知標題';
        const content = result.content?.slice(0, 300) || '無內容';
        const score = result.score ? `\n📊 相關度: ${Math.round(result.score * 100)}%` : '';
        const publishedDate = result.published_date ? `\n📅 發布時間: ${result.published_date}` : '';
        
        let additionalInfo = '';
        if (result.raw_content) {
            const cleanContent = result.raw_content
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (cleanContent.length > content.length) {
                additionalInfo = `\n📝 更多內容：${cleanContent.slice(content.length, 500)}...`;
            }
        }

        return `📌 ${title}${score}${publishedDate}\n${content}${additionalInfo}\n🔗 來源: ${result.url}\n`;
    }).join('\n');

    return formattedResults;
}

async function imagineCheck(conversationLog, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };

    if (!GENERATE_IMAGE_ENABLED) {
        return 'NO_IMAGINE';
    }
    const filteredLog = conversationLog.filter(log => log.role !== 'system');
    
    const schema = {
        type: "object",
        properties: {
            needImage: { type: "boolean" },
            prompt: { type: "string" },
            reason: { type: "string" }
        },
        required: ["needImage", "prompt", "reason"],
        additionalProperties: false
    };

    const response = await openai.chat.completions.create({
        model: analysisImagineModel,
        messages: [
            {
                role: 'system',
                content: getText('prompts.imageCheck', contextObj)
            },
            ...filteredLog
        ],
        temperature: 0.2,
        max_tokens: 150,
        response_format: {
            type: "json_schema",
            json_schema: {
                strict: true,
                schema: schema
            }
        }
    });

    try {
        let result = response.choices[0].message.parsed;

        await webhookLog(response.choices[0].message.content, "imagineCheck");
        
        if (!result) {
            const cleanedContent = response.choices[0].message.content
                .trim()
                .replace(/^```json\s*|\s*```$/g, '')
                .replace(/^`+|`+$/g, '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
            result = JSON.parse(cleanedContent);
        }
        
        if (!result || typeof result.needImage !== 'boolean' ||
            !('prompt' in result) || !('reason' in result)) {
            //console.error('Invalid JSON structure:', result);
            return "NO_IMAGINE";
        }
        
        return result.needImage ? result.prompt : "NO_IMAGINE";
    } catch (error) {
        //console.error('Error parsing imagineCheck response:', error);
        //console.error('Original content:', response.choices[0].message.content);
        return "NO_IMAGINE";
    }
}

async function imagineGenerate(prompt, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };

    const response = await openai.chat.completions.create({
        model: imaginePromptModel,
        messages: [
            {
                role: 'system',
                content: getText('prompts.imageGenerate', contextObj)
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.8
    });

    try {
        let result;
        
        if (response.choices[0].message.parsed) {
            result = response.choices[0].message.parsed;
        } else {
            const cleanedContent = response.choices[0].message.content
                .trim()
                .replace(/^```json\s*|\s*```$/g, '')
                .replace(/^`+|`+$/g, '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
            
            result = JSON.parse(cleanedContent);
        }

        await webhookLog(response.choices[0].message.content, "imagineGenerate");
        
        const encodedPrompt = encodeURIComponent(encodeURIComponent(result.prompt));
        
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${result.width}&height=${result.height}&seed=${Math.floor(Math.random() * 1000000)}&model=${result.model}&nologo=true`;
        
        return {
            ...result,
            imageUrl: imageUrl,
            originalPrompt: result.prompt
        };
    } catch (error) {
        console.error('Error generating image prompt:', error);
        return null;
    }
}

async function imagineResponse(result, message1, user, client, conversationLog, modelToUse) {
     const contextObj = {
        userId: user ? user.id : null,
        guildId: null
    };
    
    if (!result) return null;

    try {
        const response = await axios.head(result.imageUrl);
        if (response.status !== 200) {
            throw new Error('Image URL is not accessible');
        }
    } catch (error) {
        console.error('Error checking image URL:', error);
        
        return {
            content: `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('events.AICore.imageGenerationFailed', contextObj, { default: '圖片生成失敗，請稍後再試' })}`,
            embeds: [
                new EmbedBuilder()
                    .setTitle(`🎨 ${getText('events.AICore.imageGenerationFailedTitle', contextObj, { default: 'AI生成圖片失敗' })}`)
                    .setDescription(getText('events.AICore.imageGenerationFailedDesc', contextObj, { default: '無法生成圖片，可能是提示詞包含不適當內容或服務暫時無法使用。' }))
                    .setColor('#FF0000')
                    .setTimestamp()
            ]
        };
    }

    const embed = new EmbedBuilder()
        //.setTitle('🎨 AI生成圖片')
        //.setDescription(result.description)
        .addFields(
            { name: `🎯 ${getText('events.AICore.imageStyle', contextObj, { default: '風格' })}`, value: result.style, inline: true },
            { name: `📏 ${getText('events.AICore.imageSize', contextObj, { default: '尺寸' })}`, value: `${result.width}x${result.height}`, inline: true },
            { name: `🔍 ${getText('events.AICore.imagePrompt', contextObj, { default: '提示詞' })}`, value: `\`\`\`${result.originalPrompt}\`\`\``, inline: false }
        )
        .setImage(result.imageUrl)
        .setColor('#FF69B4')
        //.setTimestamp();

    /*
    let userRole = 'default';
    try {
        const userSettings = await UserSettings.findOne({ userId: user.id });
        userRole = userSettings?.model || 'default';
    } catch (error) {
        console.error('Error fetching user role:', error);
    }*/
    let model = result.model;

    const modelGroupInfo = getModelGroup(modelToUse);
    let iconURL = modelGroupInfo.iconURL || client.user.avatarURL({ dynamic: true, size: 512 });
    embed.setFooter({ text: `你爸AI  •  Image Generator  |  model: ${model}`, iconURL: iconURL });

    const questionPredictions = await generatePredictedQuestions(message1, result.description, user.id);
    const row = new ActionRowBuilder().addComponents(
        questionPredictions.map((question, index) =>
            new ButtonBuilder()
                .setCustomId(`button_${index + 1}_${user.id}`)
                .setLabel(question)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    const clearCurrentButton = new ButtonBuilder()
        .setCustomId(`updateButton_${user.id}`)
        .setLabel(getText('components.buttons.menu', contextObj, { default: '📋 多功能選單' }))
        .setStyle(ButtonStyle.Primary);
    row.addComponents(clearCurrentButton);

    const clearChatButton = new ButtonBuilder()
        .setCustomId(`clearchat_${user.id}`)
        .setLabel(getText('components.buttons.newChat', contextObj, { default: '新交談' }))
        .setStyle(ButtonStyle.Success)
        .setEmoji(`${config.emojis.newchat.id ? `<:newchat:${config.emojis.newchat.id}>` : config.emojis.newchat.fallback}`);
    row.addComponents(clearChatButton);

    return {
        embeds: [embed],
        //components: [row],
        //content: '✨ 圖片生成完成！'
    };
}

async function sendStreamingResponse(message1, channel, conversationLog, modelToUse, user, client, isButtonChat = false, question, pdfAttachments, imageAttachments) {
    let response = '';
    let originalContent = '';
    let imageEmbed = null;

    const contextObj = {
        userId: user ? user.id : null,
        guildId: null
    };
    
    if (isButtonChat) {
        response = `> -# <@${user.id}>: ${question}\n\n`;
    }
    
    let lastMessage = await message1.reply(`-# ${config.emojis.generating.id ? `<a:generating:${config.emojis.generating.id}>` : config.emojis.generating.fallback}⠀`);
    const messages = [lastMessage];
    let searchResults = null;
    let isThinking = false;

    if (pdfAttachments && pdfAttachments.length > 0) {
        await lastMessage.edit({ content: getText('common.processingPdf', contextObj) });
        const pdfContent = await handlePdfAttachments(pdfAttachments, user.id);
        
        if (pdfAttachments.length > 0 && !imageAttachments) {
        conversationLog.push({
            role: 'user',
            content: `${message1.content}\n\nPDF 內容:\n${pdfContent}`
        });
    } else if (pdfAttachments.length > 0 && imageAttachments.length > 0) {
        const processedUrls = await Promise.all(
            imageAttachments.map(attachment => processImageUrl(attachment.url, user.id))
        );
        
        const attachmentContents = processedUrls.map(url => ({
            type: "image_url",
            image_url: {
                "url": url,
                "detail": detail,
            },
        }));

        conversationLog.push({
            role: 'user',
            content: [
                { type: "text", text: `${message1.content}\n\nPDF 內容:\n${pdfContent}` },
                ...attachmentContents,
            ],
        });
    }
        
        await lastMessage.edit({ content: getText('common.pdfProcessComplete', contextObj) });
    }
    
    try {
    const isSearchEnabled = client.userNetSearchEnabled.get(user.id);

    const imagineResult = await imagineCheck(conversationLog, user.id);
    if (imagineResult === 'NO_IMAGINE') {
        //await lastMessage.edit({ content: getText('events.AICore.normalQuestion', contextObj) });
        
    } else {
        // 處理圖片生成
        await lastMessage.edit({ content: getText('events.AICore.generatingImage', contextObj) });
        const imageResult = await imagineGenerate(imagineResult, user.id);
        if (imageResult) {
            const response = await imagineResponse(imageResult, message1, user, client, conversationLog, modelToUse);
            await lastMessage.edit(response);

            imageEmbed = imageResult;
            //console.log('Image URL:', imageURL);
            
            conversationLog.push({
                role: 'assistant',
                content: `[已生成圖片] ${imageResult.description}`
            });
            
            await lastMessage.edit(`-# ${config.emojis.generating.id ? `<a:generating:${config.emojis.generating.id}>` : config.emojis.generating.fallback}⠀`);
            //return;
        } else {
            await lastMessage.edit({ content: `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('events.AICore.imageGenerationFailed', contextObj, { default: '圖片生成失敗，請稍後再試' })}` });
        }
    }
        if (isSearchEnabled) {
            const searchQuery = await extractSearchQuery(conversationLog, user.id);
        
            if (searchQuery === 'NO_SEARCH') {
                //await lastMessage.edit({ content: '-# 💭 這是一般性問題，無需網路搜尋 <a:generating:1240296442950582292>' });
            } else {                
                await lastMessage.edit({ content: `-# ${config.emojis.search.id ? `<a:search:${config.emojis.search.id}>` : config.emojis.search.fallback} ${getText('events.AICore.searching', contextObj, { default: '正在搜尋網路資訊' })}` });
                
                searchResults = await searchWithTavily(searchQuery);
                
                if (searchResults.results && searchResults.results.length > 0) {
                    const formattedResults = await formatSearchResults(searchResults.results, searchResults.answer);
    
                    if (isButtonChat) {
                        response += `> -# ${getText('events.AICore.searchResults', contextObj, { count: searchResults.results.length, default: `已搜尋到 ${searchResults.results.length} 個網頁` })}\n`;
                    } else {
                        response = `> -# ${getText('events.AICore.searchResults', contextObj, { count: searchResults.results.length, default: `已搜尋到 ${searchResults.results.length} 個網頁` })}\n`;
                    }
                    
                        conversationLog.splice(conversationLog.length - 1, 0, {
                        role: 'assistant',
                        content: `🔍 搜尋結果:\n${formattedResults}\n⚠️Power by Web-search tools`
                    });
                }
            }
        }

        let apiConfig = {
            apiKey: process.env.DEFAULT_API_KEY,
            baseURL: process.env.DEFAULT_BASE_URL
        };
    
        if (client.userDeepThinkingEnabled.get(user.id)) {
            apiConfig = {
                apiKey: process.env.DEEP_THINKING_API_KEY || process.env.DEFAULT_API_KEY,
                baseURL: process.env.DEEP_THINKING_BASE_URL || process.env.DEFAULT_BASE_URL
            };
            
            modelToUse = deepThinkingModel;
            await lastMessage.edit({ content: `${getText('events.AICore.thinking', contextObj, { default: '-# 思考中' })}${config.emojis.generating.id ? `<a:generating:${config.emojis.generating.id}>` : config.emojis.generating.fallback}` });
        }

        const aiClient = new OpenAI(apiConfig);
    
        const stream = await aiClient.chat.completions.create({
            model: modelToUse,
            messages: conversationLog,
            temperature: 0.7,
            stream: true,
        });
    
      let lastEdit = Date.now();
      const editInterval = 500;
      let usageData = null;
    
      const MAX_MESSAGE_LENGTH = 1600;
      let currentMessage = '';
    
      let currentMessageLength = 0;
    
      for await (const part of stream) {
          if (part.choices && part.choices[0] && part.choices[0].delta) {
              let content = part.choices[0].delta.content || '';

                const contentForOriginal = content
                    .replace(/<think>[\s\S]*?<\/think>/g, '')
                    .replace(/<think>[\s\S]*$/g, '');
    
                if (!isThinking) {
                    originalContent += contentForOriginal;
                }
    
                if (content.includes('<think>')) {
                    isThinking = true;
                    response += getText('events.AICore.deepThinkingStarted', contextObj);
                }
    
                if (isThinking) {
                    response += content.replace(/<\/?think>/g, '').replace(/\n/g, '\n> -# ⠀⠀⠀');
                } else {
                    response += content.replace(/<\/think>/g, '');
                }
    
                if (content.includes('</think>')) {
                    isThinking = false;
                }
    
                currentMessageLength += content.length;
    
                if (currentMessageLength >= MAX_MESSAGE_LENGTH) {
                    const splitPos = findSmartSplitPosition(response, 0, MAX_MESSAGE_LENGTH);
                    const messageToSend = response.substring(0, splitPos).trim();
                    
                    if (messageToSend.length > 0) {
                        try {
                            await lastMessage.edit(messageToSend);
                            
                            response = response.substring(splitPos).trim();
                            if (response.length > 0) {
                                lastMessage = await message1.reply(response);
                                messages.push(lastMessage);
                                currentMessageLength = response.length;
                            }
                        } catch (error) {
                            console.error('Error splitting message:', error);
                            lastMessage = await message1.reply(response);
                            messages.push(lastMessage);
                            currentMessageLength = response.length;
                        }
                    }
                } else if (Date.now() - lastEdit > editInterval && response.trim() !== '') {
                    try {
                        await lastMessage.edit(response);
                        lastEdit = Date.now();
                    } catch (error) {
                        console.error('Error editing message:', error);
                        lastMessage = await message1.reply(response);
                        messages.push(lastMessage);
                        currentMessageLength = response.length;
                    }
                }
            }
      }
    
      if (response.trim() !== '') {
          await lastMessage.edit(response);
      }
    
      if (originalContent.trim()) {
        conversationLog.push({
            role: 'assistant',
            content: originalContent.trim(),
        });
    }
    
      const textOnlyLog = conversationLog.filter(log => typeof log.content === 'string');
      const totalTokens = encodeChat(textOnlyLog, 'gpt-3.5-turbo').length;
      const modelGroupInfo = getModelGroup(modelToUse);
      let iconURL = modelGroupInfo.iconURL || client.user.avatarURL({ dynamic: true, size: 512 });

    
      /*
      // 顯示使用情況數據
      if (usageData) {
          //console.log('Usage:', usageData);
      } else {
          //console.log('Usage data not available.');
      }*/
          let userRole = 'default';
          try {
              const userSettings = await UserSettings.findOne({ userId: user.id });
              userRole = userSettings?.model || 'default';
          } catch (error) {
              console.error('Error fetching user role:', error);
          }
    
          const modelEmbed = new EmbedBuilder();

          if (imageEmbed !== null) {
              //modelEmbed.setDescription(imageEmbed.description);
              modelEmbed.addFields(
                  { name: `🎯 ${getText('events.AICore.imageStyle', contextObj, { default: '風格' })}`, value: imageEmbed.style, inline: true },
                  { name: `📏 ${getText('events.AICore.imageSize', contextObj, { default: '尺寸' })}`, value: `${imageEmbed.width}x${imageEmbed.height}`, inline: true },
                  { name: `🔍 ${getText('events.AICore.imagePrompt', contextObj, { default: '提示詞' })}`, value: `\`\`\`${imageEmbed.originalPrompt}\`\`\``, inline: false }
              );
              modelEmbed.setImage(imageEmbed.imageUrl);
              modelEmbed.setColor('#FF69B4');
          }

        // 設定 footer
        modelEmbed.setFooter({ 
            text: `你爸AI  •  ${modelToUse}  |  role: ${userRole}`, 
            iconURL: iconURL 
        });
          //.setFooter({ text: `你爸AI  •  ${modelToUse}  |  role: ${userRole}`, iconURL: iconURL });
          //.setFooter({ text: `你爸AI  •  ${modelToUse}  |  total_tokens: ${totalTokens}`, iconURL: iconURL });
      await lastMessage.edit({ content: response, embeds: [modelEmbed] });
    
      try {
        await Conversation.findOneAndUpdate(
            { userId: user.id },
            { 
                $set: { 
                    conversations: conversationLog,
                    lastUpdated: new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Error saving conversation:', error);
    }
    
      const questionPredictions = await generatePredictedQuestions(message1, originalContent, user.id);
    
      const row = new ActionRowBuilder().addComponents(
          questionPredictions.map((question, index) =>
              new ButtonBuilder()
                  .setCustomId(`button_${index + 1}_${user.id}`)
                  .setLabel(question)
                  .setStyle(ButtonStyle.Secondary)
      )
      );
    
            const deepThinkingButton = new ButtonBuilder()
            .setCustomId(`deepThinking_${user.id}`)
            .setLabel(getText('components.buttons.deepThinking', contextObj, { default: '💭 深度思考' }))
            .setStyle(client.userDeepThinkingEnabled.get(user.id) ? ButtonStyle.Primary : ButtonStyle.Secondary)
            //row.addComponents(deepThinkingButton);
    
          const clearCurrentButton = new ButtonBuilder()
          .setCustomId(`updateButton_${user.id}`)
          .setLabel(getText('components.buttons.menu', contextObj, { default: '📋 多功能選單' }))
          .setStyle(ButtonStyle.Primary)
      row.addComponents(clearCurrentButton);
    
        const clearChatButton = new ButtonBuilder()
            .setCustomId(`clearchat_${user.id}`)
            .setLabel(getText('components.buttons.newChat', contextObj, { default: '新交談' }))
            .setStyle(ButtonStyle.Success)
            .setEmoji(`${config.emojis.newchat.id ? `<:newchat:${config.emojis.newchat.id}>` : config.emojis.newchat.fallback}`);
        row.addComponents(clearChatButton);
    
      await lastMessage.edit({ content: response, embeds: [modelEmbed], components: [row] });
    
    
} catch (error) {
    console.error('Error in sendStreamingResponse:', error);
    
    const contextObj = {
        userId: user ? user.id : null,
        guildId: null
    };
    
    let errorMessage = `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('errors.aiServiceBusy', contextObj, { default: '你爹很忙，請稍後再試。' })}`;

    if (error.response?.status === 429) {
        errorMessage = `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('errors.aiServiceBusy', contextObj, { default: '你爹很忙，請稍後再試。' })}`;
    } else if (error.response?.status === 401) {
        errorMessage = `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('errors.apiAuthError', contextObj, { default: 'API 認證失敗，請聯繫管理員。' })}`;
    } else if (error.response?.status === 503) {
        errorMessage = `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('errors.aiServiceUnavailable', contextObj, { default: 'AI 服務暫時無法使用，請稍後再試。' })}`;
    } else if (error.message?.includes('context length')) {
        errorMessage = `${config.emojis.cross.id ? `<a:cross:${config.emojis.cross.id}>` : config.emojis.cross.fallback} ${getText('errors.contextTooLong', contextObj, { default: '對話內容太長，請使用「新交談」按鈕開始新的對話。' })}`;
    }

    const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setFooter({ 
            text: `${getText('events.AICore.footerError', contextObj, { model: modelToUse, default: `你爸AI  •  Error  |  ${modelToUse}` })}`, 
            iconURL: client.user.avatarURL({ dynamic: true })
        });

    try {
        await lastMessage.edit({ 
            content: errorMessage, 
            embeds: [errorEmbed],
            components: []
        });
    } catch (editError) {
        console.error('Error editing message:', editError);
        try {
            await message1.channel.send({ 
                content: errorMessage, 
                embeds: [errorEmbed] 
            });
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }

    await webhookLog(`Error in sendStreamingResponse: ${error.message}`, 'sendStreamingResponse');
}
}
  
function getModelForUser(userId, client) {
  const userModelKey = client.userModels[userId];
  if (userModelKey) {
      if (models[userModelKey]) {
          return models[userModelKey];
      } else {
          return models['default'];
      }
  } else {
      return models[client.globalModel];
  }
}

async function handleConversationSummary(conversationLog, message, attachmentContents = null, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };
    
    const systemLogs = conversationLog.filter(log => log.role === 'system');
    
    const chatLogs = conversationLog.filter(log => {
        if (log.role === 'system') return false;
        
        if (log.role === 'assistant' && 
            log.content.includes('🔍 搜尋結果:') && 
            log.content.includes('⚠️Power by Web-search tools')) {
            return false;
        }

        if (log === conversationLog[conversationLog.length - 1]) return false;
        
        return true;
    });

    const contextToSummarize = chatLogs.map(log => {
        if (typeof log.content === 'string') {
            return `${log.role === 'user' ? '用戶' : 'AI'}：${log.content}`;
        }
        if (Array.isArray(log.content)) {
            const textContent = log.content.find(item => item.type === 'text')?.text || '';
            const hasImage = log.content.some(item => item.type === 'image_url');
            return `${log.role === 'user' ? '用戶' : 'AI'}：${textContent}${hasImage ? '[包含圖片]' : ''}`;
        }
        return '';
    }).join('\n');

    const summary = await openai.chat.completions.create({
        model: summaryModel,
        messages: [
            //systemLogs[0],
            {
                role: 'system',
                content: getText('prompts.summarizeConversation', contextObj, {
                    context: contextToSummarize
                })
            }
        ],
        max_tokens: 800
    });

    conversationLog.length = 0;
    conversationLog.push(
        ...systemLogs,
        { 
            role: 'assistant', 
            content: `對話摘要：${summary.choices[0].message.content.trim()}`
        }
    );

    if (attachmentContents) {
        conversationLog.push({
            role: 'user',
            content: [
                { type: "text", text: message.content },
                ...attachmentContents
            ]
        });
    } else {
        conversationLog.push({
            role: 'user',
            content: message.content
        });
    }

    return conversationLog;
}

async function handlePdfAttachments(pdfAttachments, userID) {
    const contextObj = {
        userId: userID,
        guildId: null
    };

    let allContent = [];
    const maxPages = process.env.PDF_MAX_PAGES || 10;
    const maxCharacters = process.env.PDF_MAX_CHARACTERS || 4000;
    const maxTotalCharacters = process.env.PDF_MAX_TOTAL_CHARACTERS || 12000;
    let totalCharacters = 0;
    
    const sizeLimit = process.env.PDF_SIZE_LIMIT || '10MB';
    const maxSizeMB = parseInt(sizeLimit.replace(/MB$/i, '')) || 10;
    const maxFiles = process.env.PDF_MAX_FILES || 5;
    
    if (pdfAttachments.length > maxFiles) {
        return getText('errors.pdfMaxFiles', contextObj, { count: maxFiles });
    }
    
    const PDF_PARSE_OPTIONS = {
        max: maxPages,
        pagerender: render_page,
        version: 'v2.0.550',
        suppressConsoleLogging: true,
        verbosity: 0,
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        errorHandler: function(err) {
            if (err.name === 'TypeError' && (
                err.message.includes('undefined function') ||
                err.message.includes('TT') ||
                err.message.includes('Font')
            )) {
                return;
            }
            console.error('PDF 處理錯誤:', err);
        }
    };

    function render_page(pageData) {
        let render_options = {
            normalizeWhitespace: true,
            disableCombineTextItems: false,
            suppressWarnings: true,
            ignoreErrors: true
        };
        
        return pageData.getTextContent(render_options)
            .then(function(textContent) {
                let lastY, text = '';
                for (let item of textContent.items) {
                    if (lastY == item.transform[5] || !lastY){
                        text += item.str;
                    } else {
                        text += '\n' + item.str;
                    }
                    lastY = item.transform[5];
                }
                return text;
            });
    }

    for (const attachment of pdfAttachments) {
        try {
            const fileSizeMB = attachment.size / (1024 * 1024);
            if (fileSizeMB > maxSizeMB) {
                throw new Error(getText('errors.pdfTooLarge', contextObj, { 
                    filename: attachment.name, 
                    maxSize: maxSizeMB 
                }));
            }
            
            const response = await axios({
                url: attachment.url,
                method: 'GET',
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            const pdfBuffer = Buffer.from(response.data);
            const data = await PDFParser(pdfBuffer, PDF_PARSE_OPTIONS);
            
            if (!data || !data.text) {
                throw new Error(getText('errors.pdfParseError', contextObj, { 
                    filename: attachment.name 
                }));
            }
            
            const cleanText = data.text
                .replace(/\s+/g, ' ')
                .replace(/[^\S\r\n]+/g, ' ')
                .trim();

            if (cleanText.length > maxCharacters) {
                throw new Error(getText('errors.pdfContentTooLong', contextObj, { 
                    filename: attachment.name, 
                    maxChars: maxCharacters 
                }));
            }

            if (totalCharacters + cleanText.length > maxTotalCharacters) {
                throw new Error(getText('errors.pdfTotalContentTooLong', contextObj, { 
                    maxChars: maxTotalCharacters 
                }));
            }
            
            if (cleanText.length > 0) {
                allContent.push({
                    filename: attachment.name,
                    pages: data.numpages,
                    content: cleanText,
                    size: `${fileSizeMB.toFixed(2)}MB`
                });
                totalCharacters += cleanText.length;
                
                await webhookLog(
                    `成功處理 PDF: ${attachment.name}\n` +
                    `- 頁數: ${data.numpages}\n` +
                    `- 大小: ${fileSizeMB.toFixed(2)}MB\n` +
                    `- 內容長度: ${cleanText.length} 字符`,
                    'handlePdfAttachments'
                );
            }
            
        } catch (error) {
            console.error(`處理 PDF "${attachment.name}" 時發生錯誤:`, error);
            await webhookLog(`PDF 處理失敗: ${error.message}`, 'handlePdfAttachments');
            throw error;
        }
    }
    
    if (allContent.length === 0) {
        return getText('errors.noPdfContent', contextObj);
    }

    let output = getText('common.pdfProcessed', contextObj, { 
        count: allContent.length 
    });

    return output + allContent.map(pdf => 
        getText('common.pdfFileInfo', contextObj, {
            filename: pdf.filename,
            pages: pdf.pages,
            size: pdf.size,
            content: pdf.content
        })
    ).join('\n\n---\n\n');
}

module.exports = {
    webhookLog,
    updateUserSettings,
    getUserSettings,
    sendSplitMessages,
    updateUserSystemPrompt,
    generatePredictedQuestions,
    sendStreamingResponse,
    getModelForUser,
    handleConversationSummary,
    handlePdfAttachments
};

function findSmartSplitPosition(text, startPos, maxLength) {
    if (text.length - startPos <= maxLength) {
        return text.length;
    }

    const beforeText = text.substring(0, startPos + maxLength);
    const codeBlockMatches = beforeText.match(/```/g);
    const isInCodeBlock = codeBlockMatches && codeBlockMatches.length % 2 !== 0;

    if (isInCodeBlock) {
        let newlinePos = text.indexOf('\n', startPos + maxLength);
        if (newlinePos !== -1 && newlinePos < startPos + maxLength + 50) {
            return newlinePos + 1;
        } else {
            return startPos + maxLength;
        }
    }

    let searchEndPos = Math.min(startPos + maxLength, text.length);
    
    let paragraphEnd = text.lastIndexOf('\n\n', searchEndPos);
    if (paragraphEnd > startPos + maxLength * 0.7) {
        return paragraphEnd + 2;
    }

    let sentenceEnd = Math.max(
        text.lastIndexOf('. ', searchEndPos),
        text.lastIndexOf('! ', searchEndPos),
        text.lastIndexOf('? ', searchEndPos),
        text.lastIndexOf('。', searchEndPos),
        text.lastIndexOf('！', searchEndPos),
        text.lastIndexOf('？', searchEndPos)
    );
    if (sentenceEnd > startPos + maxLength * 0.7) {
        return sentenceEnd + 1;
    }

    let spacePos = text.lastIndexOf(' ', searchEndPos);
    if (spacePos > startPos + maxLength * 0.7) {
        return spacePos;
    }

    return startPos + maxLength;
}