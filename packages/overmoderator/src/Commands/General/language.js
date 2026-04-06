/**
 * @file language.js
 * @description language command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getText, setUserLanguage, getAvailableLanguages } = require('../../Functions/i18n');
const UserSettings = require('../../Models/UserSettings');

module.exports = {
    data: new SlashCommandBuilder()
    .setName("language")
    .setDescription("更改你的語言偏好")
    .addStringOption(option =>
        option.setName("語言")
            .setDescription("選擇語言")
            .setRequired(true)
            .addChoices(
                { name: '繁體中文', value: 'zh-TW' },
                { name: '简体中文', value: 'zh-CN' },
                { name: 'English', value: 'en-US' },
                { name: '日本語', value: 'ja-JP' }
                // other languages...
            )
        ),
    /**
     * 
     * @param {ChatInputCommandInteraction} interaction 
     */

    async execute(interaction, client) {
        const { options, user, guildId } = interaction;
        const selectedLanguage = options.getString("語言");
        
        const contextObj = {
            userId: user.id,
            guildId: guildId
        };
        
        if (selectedLanguage === interaction.userLang) {
            const sameLanguageEmbed = new EmbedBuilder()
                .setColor('Blue')
                .setDescription(getText('commands.language.messages.current', contextObj, { language: this.getLanguageName(selectedLanguage, contextObj) }));
            
            return interaction.reply({
                embeds: [sameLanguageEmbed],
                flags: MessageFlags.Ephemeral
            });
        }
        
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            await UserSettings.findOneAndUpdate(
                { userId: user.id },
                { 
                    userId: user.id,
                    language: selectedLanguage,
                    lastUpdated: Date.now()
                },
                { upsert: true, new: true }
            );
            
            setUserLanguage(user.id, selectedLanguage);
            
            interaction.userLang = selectedLanguage;
            
            const newContextObj = {
                userId: user.id,
                guildId: guildId,
                userLang: selectedLanguage
            };
            
            const successMessage = getText('common.success', newContextObj);
            const languageName = this.getLanguageName(selectedLanguage, selectedLanguage);
            
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle(successMessage)
                .setDescription(getText('commands.language.messages.changed', newContextObj, { language: languageName }));
            
            interaction.editReply({
                embeds: [embed]
            });
        } catch (error) {
            console.error(`設置用戶語言時出錯: ${error.message}`);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(getText('common.error', contextObj));
            
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.editReply({
                    embeds: [errorEmbed]
                });
            }
        }
    },
    
    getLanguageName(langCode, contextOrLang) {
        const langNames = {
            'zh-TW': {
                'zh-TW': '繁體中文',
                'zh-CN': '簡體中文',
                'en-US': 'Traditional Chinese',
                'ja-JP': '繁体字中国語'
            },
            'zh-CN': {
                'zh-TW': '繁体中文',
                'zh-CN': '简体中文',
                'en-US': 'English',
                'ja-JP': '日语'
            },
            'en-US': {
                'zh-TW': '繁體中文',
                'zh-CN': 'Simplified Chinese',
                'en-US': 'English',
                'ja-JP': '日本語'
            },
            'ja-JP': {
                'zh-TW': '繁体字中国語',
                'zh-CN': '簡体字中国語',
                'en-US': '英語',
                'ja-JP': '日本語'
            }
        };
        
        let contextObj;
        if (typeof contextOrLang === 'string') {
            contextObj = {
                userId: contextOrLang,
                guildId: null
            };
        } else {
            contextObj = contextOrLang;
        }
        
        try {
            return getText(`components.selects.languages.${langCode.replace('-', '')}`, contextObj);
        } catch (error) {
            const displayLang = typeof contextOrLang === 'string' ? contextOrLang : interaction.userLang || process.env.BOT_LANG || 'zh-TW';
            if (langNames[displayLang] && langNames[displayLang][langCode]) {
                return langNames[displayLang][langCode];
            }
            
            return langCode;
        }
    }
}; 