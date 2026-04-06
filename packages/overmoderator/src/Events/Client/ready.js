/**
 * @file ready.js
 * @description ready event
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const { loadCommands } = require("../../Handlers/commandHandler");
const { getText } = require('../../Functions/i18n');
const fs = require('fs');

module.exports = {
    name: "ready",
    once: true,
    execute(client) {        
        const defaultLanguage = process.env.BOT_LANG || 'zh-TW';
        console.log(getText('events.botReady', defaultLanguage));

        /*const currentUsername = client.user.username;
        const currentAvatarURL = client.user.avatarURL();

        if (currentUsername !== '你爸') {
        client.user.setUsername('你爸');
        }

        if (currentAvatarURL !== 'https://cdn.discordapp.com/avatars/1058987480864530554/17f2256428480cfedd280dcce929ec2d.webp') {
        client.user.setAvatar('https://cdn.discordapp.com/avatars/1058987480864530554/17f2256428480cfedd280dcce929ec2d.webp')
            .then(() => console.log('頭像設定成功'))
            .catch(console.error);
        }*/
        
        let activityIndex = 0;

        setInterval(() => {
            let models = JSON.parse(fs.readFileSync('./models.json', 'utf8'));
            if (process.env.DEFAULT_MODEL) {
                models.default = process.env.DEFAULT_MODEL;
            }
            const modelName = client.globalModel;
            const detailedName = models[modelName];

            const actvs = [
                `/help | Developed by Javis`,
                `/help | ${client.channels.cache.size} channels`,
                `/help | ${client.users.cache.size} users`,
                `/help | ${client.guilds.cache.size} servers`,
                `/help | Using ${detailedName}`,
            ]
            
            client.user.setActivity(actvs[activityIndex], {type: ActivityType.Listening});
            activityIndex = (activityIndex + 1) % actvs.length;
        }, 5000);
        
        client.user.setStatus('idle')

        loadCommands(client);

        setTimeout(() => {
            const channelId = process.env.LOG_CHANNEL;

            const channel = client.channels.cache.get(channelId);

            if (channel) {
                const defaultLanguage = process.env.BOT_LANG || 'zh-TW';
                const restartSuccessTitle = getText('events.botReady', defaultLanguage);
                
                const startEmbed = new EmbedBuilder()
                .setTitle(restartSuccessTitle)
                .setTimestamp()
                .setAuthor({name:`${client.user.tag}`, 
                iconURL: `${client.user.avatarURL({dynamic: true, size: 512})}`})

                channel.send({embeds: [startEmbed]});
            } else {
              //console.log(`Channel with ID ${channelId} was not found.`);
            }
        }, 8000);

        //console.log(`${client.user.tag} is ready!`)
    }
}