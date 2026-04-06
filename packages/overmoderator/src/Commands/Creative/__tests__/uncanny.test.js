const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const uncannyCommand = require('../uncanny');

describe('uncanny command', () => {
    test('should defer reply, send multiple embeds, and a follow-up message', async () => {
        const mockInteraction = {
            deferReply: jest.fn(() => Promise.resolve()),
            editReply: jest.fn(() => Promise.resolve()),
            followUp: jest.fn(() => Promise.resolve()),
        };

        await uncannyCommand.execute(mockInteraction);

        expect(mockInteraction.deferReply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.editReply).toHaveBeenCalledTimes(1);
        expect(mockInteraction.followUp).toHaveBeenCalledTimes(3); // 2 embeds + 1 complaint

        // Check the first embed (editReply)
        const firstEmbedCall = mockInteraction.editReply.mock.calls[0][0];
        expect(firstEmbedCall.embeds).toBeDefined();
        expect(firstEmbedCall.embeds[0]).toBeInstanceOf(EmbedBuilder);
        expect(firstEmbedCall.embeds[0].toJSON().image.url).toContain('https://placehold.co/');

        // Check the follow-up embeds and the final complaint
        const followUpCalls = mockInteraction.followUp.mock.calls;
        expect(followUpCalls[0][0].embeds[0].toJSON().image.url).toContain('https://placehold.co/');
        expect(followUpCalls[1][0].embeds[0].toJSON().image.url).toContain('https://placehold.co/');
        expect(typeof followUpCalls[2][0]).toBe('string'); // The complaint message
    });
});
