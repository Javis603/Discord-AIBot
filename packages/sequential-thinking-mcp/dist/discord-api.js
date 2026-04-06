/**
 * Discord REST API client for MCP tools.
 * Uses bot token from DISCORD_BOT_TOKEN env var.
 */
const DISCORD_API = "https://discord.com/api/v10";
function headers(token) {
    const tok = token ?? process.env.DISCORD_BOT_TOKEN ?? "";
    return {
        Authorization: `Bot ${tok}`,
        "Content-Type": "application/json",
        "User-Agent": "SequentialThinkingMCP/1.0",
    };
}
async function request(method, path, body, token) {
    try {
        const res = await fetch(`${DISCORD_API}${path}`, {
            method,
            headers: headers(token),
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        }
        catch {
            data = null;
        }
        if (!res.ok) {
            return { ok: false, status: res.status, data, error: text };
        }
        return { ok: true, status: res.status, data };
    }
    catch (err) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
// ── Fetch operations ─────────────────────────────────────────────────
export async function fetchGuild(guildId, token) {
    return request("GET", `/guilds/${guildId}?with_counts=true`, undefined, token);
}
export async function fetchGuildChannels(guildId, token) {
    return request("GET", `/guilds/${guildId}/channels`, undefined, token);
}
export async function fetchChannel(channelId, token) {
    return request("GET", `/channels/${channelId}`, undefined, token);
}
export async function fetchMessages(channelId, limit = 50, token) {
    return request("GET", `/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`, undefined, token);
}
export async function fetchGuildMembers(guildId, limit = 100, token) {
    return request("GET", `/guilds/${guildId}/members?limit=${Math.min(limit, 1000)}`, undefined, token);
}
export async function fetchGuildRoles(guildId, token) {
    return request("GET", `/guilds/${guildId}/roles`, undefined, token);
}
export async function fetchBotGuilds(token) {
    return request("GET", "/users/@me/guilds", undefined, token);
}
// ── Edit operations ──────────────────────────────────────────────────
export async function editChannel(channelId, data, token) {
    return request("PATCH", `/channels/${channelId}`, data, token);
}
export async function editMessage(channelId, messageId, data, token) {
    return request("PATCH", `/channels/${channelId}/messages/${messageId}`, data, token);
}
export async function editGuildMember(guildId, userId, data, token) {
    return request("PATCH", `/guilds/${guildId}/members/${userId}`, data, token);
}
// ── Move operations (copy + delete) ─────────────────────────────────
export async function sendMessage(channelId, data, token) {
    return request("POST", `/channels/${channelId}/messages`, data, token);
}
export async function createWebhook(channelId, name, token) {
    return request("POST", `/channels/${channelId}/webhooks`, { name }, token);
}
// ── Delete operations ────────────────────────────────────────────────
export async function deleteMessage(channelId, messageId, token) {
    return request("DELETE", `/channels/${channelId}/messages/${messageId}`, undefined, token);
}
export async function bulkDeleteMessages(channelId, messageIds, token) {
    return request("POST", `/channels/${channelId}/messages/bulk-delete`, { messages: messageIds }, token);
}
export async function deleteChannel(channelId, token) {
    return request("DELETE", `/channels/${channelId}`, undefined, token);
}
export async function kickMember(guildId, userId, token) {
    return request("DELETE", `/guilds/${guildId}/members/${userId}`, undefined, token);
}
export async function banMember(guildId, userId, reason, token) {
    return request("PUT", `/guilds/${guildId}/bans/${userId}`, { reason: reason ?? "Banned via MCP" }, token);
}
// ── Validate token ───────────────────────────────────────────────────
export async function validateToken(token) {
    return request("GET", "/users/@me", undefined, token);
}
//# sourceMappingURL=discord-api.js.map