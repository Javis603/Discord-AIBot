/**
 * @file commandHandler.js
 * @description Load commands into the client
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const path = require('path');
const ascii = require("ascii-table");
const fs = require("fs");
const { getText, getAvailableLanguages } = require('../Functions/i18n');

function loadCommands(client) {
  console.time("Command Loaded");
  const table = new ascii().setHeading("Commands", "Status");

  let commandsArray = [];

  const defaultLanguage = process.env.BOT_LANG || 'zh-TW';
  console.log(`Using ${defaultLanguage} for command description registration`);

  const originalWarn = console.warn;
  console.warn = function () { };

  //const commandsFolder = fs.readdirSync("./Commands");
  const commandsFolder = fs.readdirSync("./src/Commands").filter(item => fs.statSync(`./src/Commands/${item}`).isDirectory());
  for (const folder of commandsFolder) {
    const commandFiles = fs.readdirSync(`./src/Commands/${folder}`).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      try {
        const commandFile = require(`../Commands/${folder}/${file}`);

        const properties = { folder, ...commandFile };

        client.commands.set(commandFile.data.name, properties);

        const commandJSON = commandFile.data.toJSON();

        const commandName = commandJSON.name;
        const i18nKey = `commands.${commandName}`;

        try {
          const locDescription = getText(`${i18nKey}.description`, defaultLanguage);
          if (locDescription && locDescription !== `${i18nKey}.description`) {
            commandJSON.description = locDescription;
          }

          if (commandJSON.options && commandJSON.options.length > 0) {
            for (let i = 0; i < commandJSON.options.length; i++) {
              const option = commandJSON.options[i];
              const optionKey = `${i18nKey}.options.${option.name}`;

              const locOptionDesc = getText(`${optionKey}.description`, defaultLanguage);
              if (locOptionDesc && locOptionDesc !== `${optionKey}.description` && locOptionDesc !== option.description) {
                option.description = locOptionDesc;
              }

              if (option.choices && option.choices.length > 0) {
                for (let j = 0; j < option.choices.length; j++) {
                  const choice = option.choices[j];
                  const choiceKey = `${optionKey}.choices.${choice.value}`;

                  const locChoiceName = getText(`${choiceKey}`, defaultLanguage);
                  if (locChoiceName && locChoiceName !== choiceKey && locChoiceName !== choice.name) {
                    choice.name = locChoiceName;
                  }
                }
              }
            }
          }
        } catch (locError) {
          console.error(`Failed to load localization for ${commandName}: ${locError.message}`);
        }

        commandsArray.push(commandJSON);
        table.addRow(path.basename(file, '.js'), "🔸");
      } catch (error) {
        table.addRow(path.basename(file, '.js'), "🔺");
        console.error(`Error loading command ${file}: ${error}`);
      }
    }
  }

  console.warn = originalWarn;

  client.application.commands.set(commandsArray)
    .then(() => {
      //console.log(getText('events.commandReload', defaultLanguage));
    })
    .catch(error => {
      console.error(`Error setting global commands: ${error.message}`);
    });

  console.log(table.toString()/*, "\nLoaded Commands."*/);
  console.timeEnd("Command Loaded");
}
const passiarCommand = {
  name: 'passiar',
  description: 'Control conversation mode (passive chat)',
  options: [
    {
      type: 2, // SUB_COMMAND_GROUP
      name: 'channel',
      description: 'Channel-level passiar mode',
      options: [
        {
          type: 1, // SUB_COMMAND
          name: 'start',
          description: 'Enable passiar in this channel'
        },
        {
          type: 1, // SUB_COMMAND
          name: 'stop',
          description: 'Disable passiar in this channel'
        }
      ]
    },
    {
      type: 2, // SUB_COMMAND_GROUP
      name: 'user',
      description: 'User-level passiar mode',
      options: [
        {
          type: 1, // SUB_COMMAND
          name: 'start',
          description: 'Enable passiar for a user',
          options: [
            {
              type: 6, // USER
              name: 'user',
              description: 'Target user (defaults to you if omitted)',
              required: false
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'stop',
          description: 'Disable passiar for a user',
          options: [
            {
              type: 6, // USER
              name: 'user',
              description: 'Target user (defaults to you if omitted)',
              required: false
            }
          ]
        }
      ]
    }
  ]
};

module.exports = { loadCommands, passiarCommand };