/**
 * @file snipe.js
 * @description snipe event
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
module.exports = {
    name: "messageDelete",
    once: false,
    async execute(message, client) {
        if (!message.author || message.author.bot) return;

        // Store up to 10 recent deleted messages
        client.snipes.get(message.channel.id).push({
            content: message.content || null,
            authorId: message.author.id,
            date: Math.floor(Date.now() / 1000),
            image: message.attachments.first() ? message.attachments.first().proxyURL : null
        });
        
        if (client.snipes.get(message.channel.id).length > 10) {
            client.snipes.get(message.channel.id).shift();
        }
    }
};
