const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-temp-files')
        .setDescription('Cleans up temporary files on the configured Windows agent.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const agentUrl = process.env.WINDOWS_AGENT_URL;
        const apiKey = process.env.WINDOWS_AGENT_API_KEY;

        if (!agentUrl || !apiKey) {
            return interaction.reply({ content: 'The WINDOWS_AGENT_URL and/or WINDOWS_AGENT_API_KEY are not configured in the environment.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            await axios.post(`${agentUrl}/cleanup-temp-files`, 
                {},
                { headers: { Authorization: `Bearer ${apiKey}` } }
            );
            
            const embed = new EmbedBuilder()
                .setTitle('Temp File Cleanup')
                .setColor(0x00FF00)
                .setDescription('Successfully initiated temp file cleanup on the Windows agent.')
                .setTimestamp();

            interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error cleaning temp files on Windows agent:', error.message);
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setColor(0xFF0000)
                .setDescription('An error occurred while communicating with the Windows agent.')
                .setTimestamp();

            if (error.response && error.response.data) {
                embed.addFields({ name: 'Response Data', value: `\`\`\`\n${JSON.stringify(error.response.data, null, 2)}\n\`\`\`` });
            }

            interaction.editReply({ embeds: [embed] });
        }
    },
};
