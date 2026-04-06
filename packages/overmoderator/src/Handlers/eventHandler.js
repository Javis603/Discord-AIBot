const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../Events');

  // Load regular event files
  const eventFiles = fs.readdirSync(eventsPath, { withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.js') && !file.name.startsWith('_'))
    .map(file => file.name);

  // Load event handlers
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  // Load interaction handlers
  const interactionPath = path.join(eventsPath, 'Interaction');
  if (fs.existsSync(interactionPath)) {
    const interactionFiles = fs.readdirSync(interactionPath, { withFileTypes: true })
      .filter(file => file.isFile() && file.name.endsWith('.js'))
      .map(file => file.name);

    for (const file of interactionFiles) {
      try {
        const event = require(path.join(interactionPath, file));
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }
      } catch (error) {
        console.error(`Error loading interaction handler ${file}:`, error);
      }
    }
  }
};
