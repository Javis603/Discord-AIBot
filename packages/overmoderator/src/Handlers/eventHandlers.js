/**
 * @file eventHandlers.js
 * @description Load events
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const path = require('path');
const ascii = require("ascii-table");
const { loadFiles } = require("../Functions/fileLoader");

async function loadEvents(client) {
    console.time("Events Loaded");

    const table = new ascii().setHeading("Events", "Status");
    client.events = new Map();

    const files = await loadFiles("src/Events");

    for (const file of files) {
        try {
            const event = require(file);
            const execute = (...args) => event.execute(...args, client);
            const target = event.rest ? client.rest : client;

            target[event.once ? "once" : "on"](event.name, execute);
            client.events.set(event.name, execute);

            table.addRow(path.basename(file, '.js'), "🔸");
        } catch (error) {
            table.addRow(path.basename(file, '.js'), "🔺");
            console.log(`Error loading event ${file}: ${error}`);
        }
    }

    console.log(table.toString()/*, "\nLoaded Events."*/);
    console.timeEnd("Events Loaded");
}

module.exports = { loadEvents };
