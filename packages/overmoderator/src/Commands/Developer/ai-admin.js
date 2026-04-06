/**
 * @file ai-admin.js
 * @description Admin commands for managing AI models and roles
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const yaml = require('js-yaml');
const fs = require('fs');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
let models = JSON.parse(fs.readFileSync('./models.json', 'utf8'));
if (process.env.DEFAULT_MODEL) {
    models.default = process.env.DEFAULT_MODEL;
}
const roles = yaml.load(fs.readFileSync('./roles.yaml', 'utf8'));
const UserSettings = require('../../Models/UserSettings');
const { getText } = require('../../Functions/i18n');
const { modelGroups, specialUsers, getModelGroup } = require('../../Events/AICore/models');
const { webhookLog } = require('../../Events/AICore/utils');

const contextObj = {
    userId: 'system',
    guildId: null,
};

module.exports = {
    developer: true,
    data: new SlashCommandBuilder()
        .setName(getText('commands.ai-admin.name', contextObj))
        .setDescription(getText('commands.ai-admin.description', contextObj))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // model subcommand group
        .addSubcommandGroup(group =>
            group
                .setName(getText('commands.ai-admin.options.model.name', contextObj))
                .setDescription(getText('commands.ai-admin.options.model.description', contextObj))
                
                // global model subcommand
                .addSubcommand(subcommand =>
                    subcommand
                        .setName(getText('commands.ai-admin.options.model.options.global.name', contextObj))
                        .setDescription(getText('commands.ai-admin.options.model.options.global.description', contextObj))
                        .addStringOption(option =>
                            option.setName(getText('commands.ai-admin.options.model.options.global.options.model.name', contextObj))
                                .setDescription(getText('commands.ai-admin.options.model.options.global.options.model.description', contextObj))
                                .setRequired(true)
                                .addChoices(...Object.keys(models).map(model => ({ name: model, value: model })))
                        )
                )
                
                // user model subcommand
                .addSubcommand(subcommand =>
                    subcommand
                        .setName(getText('commands.ai-admin.options.model.options.user.name', contextObj))
                        .setDescription(getText('commands.ai-admin.options.model.options.user.description', contextObj))
                        .addUserOption(option =>
                            option.setName(getText('commands.ai-admin.options.model.options.user.options.user.name', contextObj))
                                .setDescription(getText('commands.ai-admin.options.model.options.user.options.user.description', contextObj))
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option.setName(getText('commands.ai-admin.options.model.options.user.options.model.name', contextObj))
                                .setDescription(getText('commands.ai-admin.options.model.options.user.options.model.description', contextObj))
                                .setRequired(true)
                                .addChoices(...Object.keys(models).map(model => ({ name: model, value: model })))
                        )
                )
        )
        
        // role subcommand group
        .addSubcommandGroup(group =>
            group
                .setName(getText('commands.ai-admin.options.role.name', contextObj))
                .setDescription(getText('commands.ai-admin.options.role.description', contextObj))
                
                // user role subcommand
                .addSubcommand(subcommand =>
                    subcommand
                        .setName(getText('commands.ai-admin.options.role.options.user.name', contextObj))
                        .setDescription(getText('commands.ai-admin.options.role.options.user.description', contextObj))
                        .addUserOption(option =>
                            option.setName(getText('commands.ai-admin.options.role.options.user.options.user.name', contextObj))
                                .setDescription(getText('commands.ai-admin.options.role.options.user.options.user.description', contextObj))
                                .setRequired(true)
                        )
                        .addStringOption(option => {
                            option.setName(getText('commands.ai-admin.options.role.options.user.options.role.name', contextObj))
                                .setDescription(getText('commands.ai-admin.options.role.options.user.options.role.description', contextObj))
                                .setRequired(true);

                            const choices = [];
                            for (const role in roles) {
                                choices.push({ name: role, value: role });
                            }
                            option.addChoices(...choices); 
                            return option;
                        })
                )
        ),

    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     * @param {Client} client 
     */
    async execute(interaction, client) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };

        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();

        // for /ai-admin model global
        if (group === "model" && subcommand === "global") {
            const selectedModelKey = interaction.options.getString('model');
            const selectedModel = models[selectedModelKey];
            
            if (selectedModel || selectedModelKey === 'default') {
                client.globalModel = selectedModelKey;
                
                const modelName = models[selectedModelKey];
                const { name: groupName, iconURL } = getModelGroup(modelName);
                    
                const embed = new EmbedBuilder()
                    .setColor(interaction.member.displayHexColor)
                    .setTitle(getText('commands.ai-admin.messages.model.global.success', contextObj, { default: '全局模型已設定' }))
                    .setDescription(getText('commands.ai-admin.messages.model.global.description', contextObj, { 
                        model: `${selectedModelKey} (${selectedModel})`,
                        default: `全局AI模型已設定為：${selectedModelKey} (${selectedModel})`
                    }))
                    .setThumbnail(iconURL)
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
                console.log(`全局模型已更改為：${selectedModel}`);
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai-admin.messages.model.global.invalid', contextObj, { 
                        models: Object.keys(models).join(', '),
                        default: `無效的模型。可用的模型有：${Object.keys(models).join(', ')}`
                    }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
        
        // for /ai-admin model user
        else if (group === "model" && subcommand === "user") {
            const targetUser = interaction.options.getUser("user");
            const selectedModelKey = interaction.options.getString('model');

            if (models[selectedModelKey]) {
                try {
                    if (selectedModelKey === 'default') {
                        delete client.userModels[targetUser.id];
                    } else {
                        client.userModels[targetUser.id] = selectedModelKey;
                    }

                    const modelName = models[selectedModelKey];
                    const { name: groupName, iconURL } = getModelGroup(modelName);
                    
                    const embed = new EmbedBuilder()
                        .setColor(interaction.member.displayHexColor)
                        .setTitle(getText('commands.ai-admin.messages.model.user.success', contextObj, { default: '用戶模型設置成功' }))
                        .setDescription(getText('commands.ai-admin.messages.model.user.description', contextObj, { 
                            user: `<@${targetUser.id}>`,
                            model: `${selectedModelKey} (${models[selectedModelKey]})`,
                            default: `已為 <@${targetUser.id}> 設定AI模型：${selectedModelKey} (${models[selectedModelKey]})`
                        }))
                        .setThumbnail(iconURL)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                    await webhookLog(`管理員 ${interaction.user.username} 為用戶 ${targetUser.username} 設定AI模型：${selectedModelKey} (${models[selectedModelKey]})`, 'ai-admin-model-user');
                } catch (error) {
                    console.error('設定用戶模型時出錯:', error);
                    await interaction.reply({ 
                        content: getText('commands.ai-admin.messages.model.user.error', contextObj, { 
                            error: error.message,
                            default: `設置用戶模型時發生錯誤: ${error.message}`
                        }), 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai-admin.messages.model.user.invalid', contextObj, {
                        models: Object.keys(models).join(', '),
                        default: `無效的模型。可用的模型有：${Object.keys(models).join(', ')}`
                    }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
        
        // for /ai-admin role user
        else if (group === "role" && subcommand === "user") {
            const targetUser = interaction.options.getUser("user");
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const selectedRole = interaction.options.getString('role');

            if (roles[selectedRole]) {
                const specialUser = specialUsers[targetUser.id];
                const relation = specialUser ? specialUser.relation : '用戶';
                const username = specialUser ? specialUser.username : (targetMember ? targetMember.displayName : targetUser.username);
                
                client.userModels[targetUser.id] = {
                    role: selectedRole
                };
                
                const webSearchStatus = client.userNetSearchEnabled.get(targetUser.id) ? "開啟" : "關閉，需要用戶在多功能選單裏面打開";
                const deepThinkingStatus = client.userDeepThinkingEnabled.get(targetUser.id) ? "開啟" : "關閉，需要用戶在多功能選單裏面打開";
                
                const systemContent = roles[selectedRole]
                    .replace(/{username}/g, username)
                    .replace(/{relation}/g, relation)
                    .replace(/{WebSerach}/g, webSearchStatus)
                    .replace(/{DeepThinking}/g, deepThinkingStatus);
                
                if (client.userConversations[targetUser.id]) {
                    let conversation = client.userConversations[targetUser.id];
                    if (conversation.length > 0 && conversation[0].role === 'system') {
                        conversation[0].content = systemContent;
                    } else {
                        conversation.unshift({ role: 'system', content: systemContent });
                    }
                } else {
                    client.userConversations[targetUser.id] = [
                        { role: 'system', content: systemContent }
                    ];
                }

                await UserSettings.findOneAndUpdate(
                    { userId: targetUser.id },
                    { 
                        model: selectedRole,
                        lastUpdated: new Date()
                    },
                    { upsert: true }
                );

                const embed = new EmbedBuilder()
                    .setTitle(getText('commands.ai-admin.messages.role.user.successTitle', contextObj, { default: '角色設定成功' }))
                    .setDescription(getText('commands.ai-admin.messages.role.user.success', contextObj, { 
                        user: `<@${targetUser.id}>`,
                        role: selectedRole,
                        default: `已為 <@${targetUser.id}> 設定AI角色：${selectedRole}`
                    }))
                    .setThumbnail(targetUser.displayAvatarURL());

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                await webhookLog(`管理員 ${interaction.user.username} 為用戶 ${targetUser.username} 設定AI角色：${selectedRole}`, 'ai-admin-role-user');
            } else {
                await interaction.reply({ 
                    content: getText('commands.ai-admin.messages.role.user.invalid', contextObj, { 
                        roles: Object.keys(roles).join(', '),
                        default: `無效的角色。可用的角色有：${Object.keys(roles).join(', ')}`
                    }), 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    }
}
