/**
 * @file help.js
 * @description help command
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { ComponentType, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle  } = require("discord.js");
const { getText } = require('../../Functions/i18n');
const config = require('../../../config.json');
  
module.exports = {
  guildOnly: false,
    data: new SlashCommandBuilder()
      .setName("help")
      .setDescription("查看指令列表"),
    async execute(interaction, client) {
        const contextObj = {
            userId: interaction.user.id,
            guildId: interaction.guildId
        };
        
      const emojis = {
        developer: "🔒", //👑
        info: "ℹ️",
        moderation: "🛡️",
        general: "⚙️",
        ai: "🤖",
        //app: "📱",
        //fun: "👾",
      };
  
      const directories = [
        ...new Set(interaction.client.commands.map((cmd) => cmd.folder)),
      ];
  
      const formatString = (str) =>
        `${str[0].toUpperCase()}${str.slice(1).toLowerCase()}`;
        
      const formatSubcommands = (cmd) => {
        const commandData = cmd.data.toJSON();
        let subcommandsInfo = [];
        
        if (commandData.options) {
          commandData.options.forEach(option => {
            if (option.type === 1) {
              subcommandsInfo.push({
                name: option.name,
                description: option.description,
                type: 'subcommand'
              });
            } else if (option.type === 2) {
              subcommandsInfo.push({
                name: option.name,
                description: option.description,
                type: 'subcommandGroup'
              });
              
              if (option.options) {
                option.options.forEach(subOption => {
                  if (subOption.type === 1) {
                    subcommandsInfo.push({
                      name: `${option.name} ${subOption.name}`,
                      description: subOption.description,
                      type: 'nestedSubcommand'
                    });
                  }
                });
              }
            }
          });
        }
        
        return subcommandsInfo;
      };
  
      const categories = directories.map((dir) => {
        const getCommands = interaction.client.commands
          .filter((cmd) => cmd.folder === dir)
          .map((cmd) => {
            const subcommands = formatSubcommands(cmd);
            return {
              name: cmd.data.name,
              description: cmd.data.description || getText('common.unknown', contextObj),
              subcommands: subcommands.length > 0 ? subcommands : null,
            };
          });
  
        return {
          directory: formatString(dir),
          commands: getCommands,
        };
      });
  
      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${client.user.username} ${getText('commands.command', contextObj)}`, 
          iconURL: `${client.user.avatarURL({dynamic: true, size: 512})}`
        })
        .setDescription(
          `${getText('commands.help.messages.description', contextObj, { botId: client.user.id })}`
        )
        .setThumbnail(client.user.displayAvatarURL());
  
      const components = (state) => [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("help-menu")
            .setPlaceholder(getText('components.selects.placeholder', contextObj))
            .setDisabled(state)
            .addOptions(
              categories.map((cmd) => {
                return {
                  label: cmd.directory,
                  value: cmd.directory.toLowerCase(),
                  description: `${getText('commands.help.messages.categoryDescription', contextObj, { category: cmd.directory })}`,
                  emoji: emojis[cmd.directory.toLowerCase() || null],
                };
              })
            )
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("View on GitHub")
              .setURL("https://github.com/Javis603/Discord-AIBot")
              .setStyle(ButtonStyle.Link)
              .setEmoji(`${config.emojis.github.id ? `<:github:${config.emojis.github.id}>` : config.emojis.github.fallback}`),
            new ButtonBuilder()
              .setLabel("Join Discord Server")
              .setURL("https://discord.gg/HmdNVVvw5P")
              .setStyle(ButtonStyle.Link)
              .setEmoji("🔗")
          ),
        ];
  
      const initialMessage = await interaction.reply({
        embeds: [embed],
        components: components(false),
      });
  
      const filter = (i) => i.user.id === interaction.user.id;
  
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 900000, // 15 minutes
      });

      collector.on("collect", async (i) => {
        const [directory] = i.values;
        const category = categories.find(
          (x) => x.directory.toLowerCase() === directory
        );
        
        const categoryEmbed = new EmbedBuilder()
          .setTitle(`${formatString(directory)} ${getText('commands.command', contextObj)}`)
          .setColor(interaction.member.displayHexColor);
        
        category.commands.forEach(cmd => {
          let commandValue = `${cmd.description}\n`;
          
          if (cmd.subcommands && cmd.subcommands.length > 0) {
            const allExecutableCommands = [];
            
            cmd.subcommands.forEach(sub => {
              if (sub.type === 'subcommand') {
                allExecutableCommands.push({
                  command: `/${cmd.name} ${sub.name}`,
                  description: sub.description
                });
              } else if (sub.type === 'nestedSubcommand') {
                const [groupName, subName] = sub.name.split(' ');
                allExecutableCommands.push({
                  command: `/${cmd.name} ${groupName} ${subName}`,
                  description: sub.description
                });
              }
            });
            
            allExecutableCommands.sort((a, b) => a.command.localeCompare(b.command));
            
            allExecutableCommands.forEach(cmdInfo => {
              commandValue += `\`${cmdInfo.command}\` - ${cmdInfo.description}\n`;
            });
          }
          
          categoryEmbed.addFields({
            name: `/${cmd.name}`,
            value: commandValue.trim(),
            inline: false
          });
        });
  
        i.update({ embeds: [categoryEmbed] }).catch(() => {
          // nothing
        });
      });

      collector.on("end", () => {
        initialMessage.edit({ components: components(true) }).catch(() => {
          // nothing
        });
      });
    },
  };