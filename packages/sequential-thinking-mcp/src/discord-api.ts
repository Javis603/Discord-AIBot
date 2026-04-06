/**
 * Discord REST API client for MCP tools.
 * Uses bot token from DISCORD_BOT_TOKEN env var.
 */

const DISCORD_API = "https://discord.com/api/v10";

function headers(token?: string): Record<string, string> {
  const tok = token ?? process.env.DISCORD_BOT_TOKEN ?? "";
  return {
    Authorization: `Bot ${tok}`,
    "Content-Type": "application/json",
    "User-Agent": "SequentialThinkingMCP/1.0",
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: headers(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: T | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: text };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Fetch operations ─────────────────────────────────────────────────

export async function fetchGuild(guildId: string, token?: string) {
  return request<Record<string, unknown>>("GET", `/guilds/${guildId}?with_counts=true`, undefined, token);
}

export async function fetchGuildChannels(guildId: string, token?: string) {
  return request<unknown[]>("GET", `/guilds/${guildId}/channels`, undefined, token);
}

export async function fetchChannel(channelId: string, token?: string) {
  return request<Record<string, unknown>>("GET", `/channels/${channelId}`, undefined, token);
}

export async function fetchMessages(channelId: string, limit = 50, token?: string) {
  return request<unknown[]>("GET", `/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`, undefined, token);
}

export async function fetchGuildMembers(guildId: string, limit = 100, token?: string) {
  return request<unknown[]>("GET", `/guilds/${guildId}/members?limit=${Math.min(limit, 1000)}`, undefined, token);
}

export async function fetchGuildRoles(guildId: string, token?: string) {
  return request<unknown[]>("GET", `/guilds/${guildId}/roles`, undefined, token);
}

export async function fetchBotGuilds(token?: string) {
  return request<unknown[]>("GET", "/users/@me/guilds", undefined, token);
}

// ── Edit operations ──────────────────────────────────────────────────

export async function editChannel(
  channelId: string,
  data: Record<string, unknown>,
  token?: string
) {
  return request<Record<string, unknown>>("PATCH", `/channels/${channelId}`, data, token);
}

export async function editMessage(
  channelId: string,
  messageId: string,
  data: { content?: string; embeds?: unknown[] },
  token?: string
) {
  return request<Record<string, unknown>>("PATCH", `/channels/${channelId}/messages/${messageId}`, data, token);
}

export async function editGuildMember(
  guildId: string,
  userId: string,
  data: Record<string, unknown>,
  token?: string
) {
  return request<Record<string, unknown>>("PATCH", `/guilds/${guildId}/members/${userId}`, data, token);
}

// ── Move operations (copy + delete) ─────────────────────────────────

export async function sendMessage(
  channelId: string,
  data: { content?: string; embeds?: unknown[]; components?: unknown[] },
  token?: string
) {
  return request<Record<string, unknown>>("POST", `/channels/${channelId}/messages`, data, token);
}

export async function createWebhook(channelId: string, name: string, token?: string) {
  return request<Record<string, unknown>>("POST", `/channels/${channelId}/webhooks`, { name }, token);
}

// ── Delete operations ────────────────────────────────────────────────

export async function deleteMessage(channelId: string, messageId: string, token?: string) {
  return request<null>("DELETE", `/channels/${channelId}/messages/${messageId}`, undefined, token);
}

export async function bulkDeleteMessages(channelId: string, messageIds: string[], token?: string) {
  return request<null>("POST", `/channels/${channelId}/messages/bulk-delete`, { messages: messageIds }, token);
}

export async function deleteChannel(channelId: string, token?: string) {
  return request<Record<string, unknown>>("DELETE", `/channels/${channelId}`, undefined, token);
}

export async function kickMember(guildId: string, userId: string, token?: string) {
  return request<null>("DELETE", `/guilds/${guildId}/members/${userId}`, undefined, token);
}

export async function banMember(
  guildId: string,
  userId: string,
  reason?: string,
  token?: string
) {
  return request<null>(
    "PUT",
    `/guilds/${guildId}/bans/${userId}`,
    { reason: reason ?? "Banned via MCP" },
    token
  );
}

// ── Validate token ───────────────────────────────────────────────────

export async function validateToken(token?: string) {
  return request<Record<string, unknown>>("GET", "/users/@me", undefined, token);
}
