/**
 * Discord REST API client for MCP tools.
 * Uses bot token from DISCORD_BOT_TOKEN env var.
 */
export declare function fetchGuild(guildId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function fetchGuildChannels(guildId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: unknown[] | null;
    error?: string;
}>;
export declare function fetchChannel(channelId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function fetchMessages(channelId: string, limit?: number, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: unknown[] | null;
    error?: string;
}>;
export declare function fetchGuildMembers(guildId: string, limit?: number, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: unknown[] | null;
    error?: string;
}>;
export declare function fetchGuildRoles(guildId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: unknown[] | null;
    error?: string;
}>;
export declare function fetchBotGuilds(token?: string): Promise<{
    ok: boolean;
    status: number;
    data: unknown[] | null;
    error?: string;
}>;
export declare function editChannel(channelId: string, data: Record<string, unknown>, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function editMessage(channelId: string, messageId: string, data: {
    content?: string;
    embeds?: unknown[];
}, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function editGuildMember(guildId: string, userId: string, data: Record<string, unknown>, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function sendMessage(channelId: string, data: {
    content?: string;
    embeds?: unknown[];
    components?: unknown[];
}, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function createWebhook(channelId: string, name: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function deleteMessage(channelId: string, messageId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: null;
    error?: string;
}>;
export declare function bulkDeleteMessages(channelId: string, messageIds: string[], token?: string): Promise<{
    ok: boolean;
    status: number;
    data: null;
    error?: string;
}>;
export declare function deleteChannel(channelId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
export declare function kickMember(guildId: string, userId: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: null;
    error?: string;
}>;
export declare function banMember(guildId: string, userId: string, reason?: string, token?: string): Promise<{
    ok: boolean;
    status: number;
    data: null;
    error?: string;
}>;
export declare function validateToken(token?: string): Promise<{
    ok: boolean;
    status: number;
    data: Record<string, unknown> | null;
    error?: string;
}>;
//# sourceMappingURL=discord-api.d.ts.map