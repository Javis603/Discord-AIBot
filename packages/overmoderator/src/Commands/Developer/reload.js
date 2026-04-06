/**
 * @file reload.js
 * @description reload command/event command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, Client, Options, MessageFlags } = require('discord.js');
const { loadCommands } = require("../../Handlers/commandHandler");
const { loadEvents } = require("../../Handlers/eventHandlers");
const fs = require('fs');
const path = require('path');
const { getText } = require('../../Functions/i18n');

module.exports = {
    developer: true,
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('重新加載命令/事件')
        .addSubcommand(subcommand =>
            subcommand
                .setName('commands')
                .setDescription('𝒹𝑒𝓋𝑒𝓁𝑜𝓅𝑒𝓇 𝑜𝓃𝓁𝓎 • 重新加載命令'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('events')
                .setDescription('𝒹𝑒𝓋𝑒𝓁𝑜𝓅𝑒𝓇 𝑜𝓃𝓁𝓎 • 重新加載事件'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, client) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'commands') {
                clearCommandCache();
                await loadCommands(client);
                await interaction.reply({ 
                    content: getText('commands.reload.messages.commandsSuccess', contextObj), 
                    flags: MessageFlags.Ephemeral 
                });
            } else if (subcommand === 'events') {
                clearEventCache(client);
                await loadEvents(client);
                await interaction.reply({ 
                    content: getText('commands.reload.messages.eventsSuccess', contextObj), 
                    flags: MessageFlags.Ephemeral 
                });
            } else {
                await interaction.reply({ content: 'Invalid reload type specified.', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: getText('common.error', contextObj), 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};

function clearCommandCache() {
    const commandFolders = fs.readdirSync('./src/Commands').filter(file => 
        fs.statSync(path.join('./src/Commands', file)).isDirectory()
    );
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./src/Commands/${folder}`).filter(file => 
            file.endsWith('.js')
        );
        
        for (const file of commandFiles) {
            const filePath = path.resolve(`./src/Commands/${folder}/${file}`);
            delete require.cache[require.resolve(filePath)];
        }
    }
}

function clearEventCache(client) {
    client.removeAllListeners();
    
    const eventFiles = fs.readdirSync('./src/Events').filter(file => 
        file.endsWith('.js')
    );
    
    for (const file of eventFiles) {
        const filePath = path.resolve(`./src/Events/${file}`);
        delete require.cache[require.resolve(filePath)];
    }
}