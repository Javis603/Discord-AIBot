const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('get-disk-space')
        .setDescription('Gets disk space information from the configured Windows agent.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const agentUrl = process.env.WINDOWS_AGENT_URL;
        const apiKey = process.env.WINDOWS_AGENT_API_KEY;

        if (!agentUrl || !apiKey) {
            return interaction.reply({ content: 'The WINDOWS_AGENT_URL and/or WINDOWS_AGENT_API_KEY are not configured in the environment.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const response = await axios.get(`${agentUrl}/get-disk-space`, 
                { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            const { drives } = response.data;

            const embed = new EmbedBuilder()
                .setTitle('Disk Space Information')
                .setColor(0x00FF00)
                .setTimestamp();

            if (Array.isArray(drives)) {
                drives.forEach(drive => {
                    embed.addFields(
                        { name: `Drive ${drive.Name}`, value: '\u200B' },
                        { name: 'Used Space', value: `${drive.Used.toFixed(2)} GB`, inline: true },
                        { name: 'Free Space', value: `${drive.Free.toFixed(2)} GB`, inline: true }
                    );
                });
            } else { // Handle single drive object
                embed.addFields(
                    { name: `Drive ${drives.Name}`, value: '\u200B' },
                    { name: 'Used Space', value: `${drives.Used.toFixed(2)} GB`, inline: true },
                    { name: 'Free Space', value: `${drives.Free.toFixed(2)} GB`, inline: true }
                );
            }


            interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error getting disk space on Windows agent:', error.message);
            let errorMessage = 'An error occurred while communicating with the Windows agent.';
            if (error.response && error.response.data) {
                errorMessage += `\n\`\`\`\n${JSON.stringify(error.response.data, null, 2)}\n\`\`\``;
            }
            interaction.editReply({ content: errorMessage });
        }
    },
};
