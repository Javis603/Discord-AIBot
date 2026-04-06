const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-container')
        .setDescription('Cleans up temporary files in the container.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        exec('rm -rf /tmp/*', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                interaction.editReply({ content: `An error occurred while cleaning up the container: ${error.message}` });
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                interaction.editReply({ content: `An error occurred while cleaning up the container: ${stderr}` });
                return;
            }
            interaction.editReply({ content: 'Container cleanup successful.' });
        });
    },
};
