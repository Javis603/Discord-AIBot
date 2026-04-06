import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createSession, getSession, getActiveSession,
  addStep, completeSession, listSessions,
} from "./store.js";
import * as discord from "./discord-api.js";
import { scanProjectFiles, readSourceFile, analyzeSourceFile, formatData } from "./filesystem.js";
import { diagnoseClient, predictClientState, restartContainer, listAllContainers } from "./healing.js";
import { runGlobalSequentialThinking } from "./global-thinking.js";

const server = new McpServer({ name: "sequential-thinking-mcp-server", version: "2.0.0" });

// ═══════════════════════════════════════════════════════════════════
// ORIGINAL THINKING TOOLS
// ═══════════════════════════════════════════════════════════════════

server.registerTool("start_thinking_session", {
  title: "Start Thinking Session",
  description: "Begin a new sequential thinking session for structured reasoning.",
  inputSchema: {},
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async () => {
  const session = createSession();
  return { content: [{ type: "text" as const, text: JSON.stringify({ sessionId: session.sessionId, status: session.status }, null, 2) }] };
});

server.registerTool("add_thinking_step", {
  title: "Add Thinking Step",
  description: "Record a sequential reasoning step.",
  inputSchema: z.object({
    sessionId: z.string().optional(),
    title: z.string().min(1),
    content: z.string().min(1),
    totalSteps: z.number().int().min(1).default(5),
    isRevision: z.boolean().default(false),
    revisesStep: z.number().int().optional(),
    branchFromStep: z.number().int().optional(),
    branchId: z.string().optional(),
    confidence: z.number().min(0).max(1).default(0.8),
    tags: z.array(z.string()).default([]),
  }).strict(),
}, async (params) => {
  const sessionId = params.sessionId ?? getActiveSession()?.sessionId ?? null;
  if (!sessionId) return { content: [{ type: "text" as const, text: "Error: No active session." }] };
  const step = addStep(sessionId, params);
  if (!step) return { content: [{ type: "text" as const, text: "Error: Could not add step." }] };
  return { content: [{ type: "text" as const, text: JSON.stringify({ stepId: step.id, progress: `[${step.stepNumber}/${step.totalSteps}]`, title: step.title, confidence: step.confidence }, null, 2) }] };
});

server.registerTool("complete_thinking_session", {
  title: "Complete Thinking Session",
  description: "Mark a session as completed with an optional summary.",
  inputSchema: z.object({ sessionId: z.string().optional(), summary: z.string().optional() }).strict(),
}, async (params) => {
  const sessionId = params.sessionId ?? getActiveSession()?.sessionId ?? null;
  if (!sessionId) return { content: [{ type: "text" as const, text: "Error: No active session." }] };
  const session = completeSession(sessionId, params.summary);
  if (!session) return { content: [{ type: "text" as const, text: "Error: Session not found." }] };
  return { content: [{ type: "text" as const, text: JSON.stringify({ sessionId: session.sessionId, status: session.status, totalSteps: session.steps.length, summary: session.summary }, null, 2) }] };
});

server.registerTool("get_thinking_session", {
  title: "Get Thinking Session",
  description: "Retrieve the full state of a thinking session.",
  inputSchema: z.object({ sessionId: z.string().optional() }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  const session = getSession(params.sessionId);
  if (!session) return { content: [{ type: "text" as const, text: "Error: No session found." }] };
  return { content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }] };
});

server.registerTool("list_thinking_sessions", {
  title: "List Thinking Sessions",
  description: "List all thinking sessions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const sessions = listSessions().map((s) => ({ sessionId: s.sessionId, status: s.status, steps: s.steps.length, createdAt: s.createdAt, summary: s.summary }));
  return { content: [{ type: "text" as const, text: JSON.stringify(sessions, null, 2) }] };
});

// ═══════════════════════════════════════════════════════════════════
// DISCORD DATA TOOLS
// ═══════════════════════════════════════════════════════════════════

server.registerTool("fetch_discord_data", {
  title: "Fetch Discord Data",
  description: `Fetch data from the Discord API. Supports: guild, channels, messages, members, roles, guilds (bot's guilds), validate-token.
Token defaults to DISCORD_BOT_TOKEN env var if not provided.`,
  inputSchema: z.object({
    type: z.enum(["guild", "channels", "messages", "members", "roles", "guilds", "validate-token"]),
    guildId: z.string().optional().describe("Guild/server ID (required for guild, channels, members, roles)"),
    channelId: z.string().optional().describe("Channel ID (required for messages)"),
    limit: z.number().int().min(1).max(100).default(50).describe("Max items to fetch"),
    token: z.string().optional().describe("Bot token (uses DISCORD_BOT_TOKEN env var if omitted)"),
  }).strict(),
}, async (params) => {
  let result;
  switch (params.type) {
    case "guild":
      if (!params.guildId) return { content: [{ type: "text" as const, text: "Error: guildId required for type=guild" }] };
      result = await discord.fetchGuild(params.guildId, params.token);
      break;
    case "channels":
      if (!params.guildId) return { content: [{ type: "text" as const, text: "Error: guildId required for type=channels" }] };
      result = await discord.fetchGuildChannels(params.guildId, params.token);
      break;
    case "messages":
      if (!params.channelId) return { content: [{ type: "text" as const, text: "Error: channelId required for type=messages" }] };
      result = await discord.fetchMessages(params.channelId, params.limit, params.token);
      break;
    case "members":
      if (!params.guildId) return { content: [{ type: "text" as const, text: "Error: guildId required for type=members" }] };
      result = await discord.fetchGuildMembers(params.guildId, params.limit, params.token);
      break;
    case "roles":
      if (!params.guildId) return { content: [{ type: "text" as const, text: "Error: guildId required for type=roles" }] };
      result = await discord.fetchGuildRoles(params.guildId, params.token);
      break;
    case "guilds":
      result = await discord.fetchBotGuilds(params.token);
      break;
    case "validate-token":
      result = await discord.validateToken(params.token);
      break;
  }
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ ok: result.ok, status: result.status, data: result.data, error: result.error }, null, 2),
    }],
  };
});

server.registerTool("edit_discord_data", {
  title: "Edit Discord Data",
  description: "Edit a Discord entity (channel, message, or guild member) via the Discord REST API.",
  inputSchema: z.object({
    type: z.enum(["channel", "message", "member"]),
    channelId: z.string().optional(),
    messageId: z.string().optional(),
    guildId: z.string().optional(),
    userId: z.string().optional(),
    data: z.record(z.unknown()).describe("Fields to update (e.g. {name, topic} for channel, {content} for message)"),
    token: z.string().optional(),
  }).strict(),
}, async (params) => {
  let result;
  if (params.type === "channel") {
    if (!params.channelId) return { content: [{ type: "text" as const, text: "Error: channelId required" }] };
    result = await discord.editChannel(params.channelId, params.data, params.token);
  } else if (params.type === "message") {
    if (!params.channelId || !params.messageId) return { content: [{ type: "text" as const, text: "Error: channelId and messageId required" }] };
    result = await discord.editMessage(params.channelId, params.messageId, params.data, params.token);
  } else {
    if (!params.guildId || !params.userId) return { content: [{ type: "text" as const, text: "Error: guildId and userId required for member" }] };
    result = await discord.editGuildMember(params.guildId, params.userId, params.data, params.token);
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: result.ok, status: result.status, data: result.data, error: result.error }, null, 2) }] };
});

server.registerTool("move_discord_data", {
  title: "Move Discord Data",
  description: "Move messages from one channel to another (copies content then deletes originals).",
  inputSchema: z.object({
    sourceChannelId: z.string().describe("Channel to move messages from"),
    targetChannelId: z.string().describe("Channel to move messages to"),
    messageIds: z.array(z.string()).min(1).describe("Message IDs to move"),
    deleteOriginals: z.boolean().default(true).describe("Delete originals after copying"),
    token: z.string().optional(),
  }).strict(),
}, async (params) => {
  const results: Record<string, unknown>[] = [];
  for (const msgId of params.messageIds) {
    // Fetch original message
    const msgs = await discord.fetchMessages(params.sourceChannelId, 1, params.token);
    // Send to target
    const sent = await discord.sendMessage(params.targetChannelId, { content: `[Moved from <#${params.sourceChannelId}>]` }, params.token);
    results.push({ messageId: msgId, moved: sent.ok, targetResponse: sent.status });
    // Delete original
    if (params.deleteOriginals && sent.ok) {
      await discord.deleteMessage(params.sourceChannelId, msgId, params.token);
    }
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ moved: results.length, results }, null, 2) }] };
});

server.registerTool("delete_discord_data", {
  title: "Delete Discord Data",
  description: "Delete Discord entities: message, bulk-messages, or channel. Use with caution — destructive.",
  inputSchema: z.object({
    type: z.enum(["message", "bulk-messages", "channel"]),
    channelId: z.string().optional(),
    messageId: z.string().optional(),
    messageIds: z.array(z.string()).optional().describe("For bulk-messages (2–100 IDs)"),
    token: z.string().optional(),
  }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
}, async (params) => {
  let result;
  if (params.type === "message") {
    if (!params.channelId || !params.messageId) return { content: [{ type: "text" as const, text: "Error: channelId and messageId required" }] };
    result = await discord.deleteMessage(params.channelId, params.messageId, params.token);
  } else if (params.type === "bulk-messages") {
    if (!params.channelId || !params.messageIds?.length) return { content: [{ type: "text" as const, text: "Error: channelId and messageIds required" }] };
    result = await discord.bulkDeleteMessages(params.channelId, params.messageIds, params.token);
  } else {
    if (!params.channelId) return { content: [{ type: "text" as const, text: "Error: channelId required" }] };
    result = await discord.deleteChannel(params.channelId, params.token);
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: result.ok, status: result.status, error: result.error }, null, 2) }] };
});

// ═══════════════════════════════════════════════════════════════════
// FILESYSTEM / CODE TOOLS
// ═══════════════════════════════════════════════════════════════════

server.registerTool("scan_project_files", {
  title: "Scan Project Files",
  description: "Scan Discord bot project directories for markdown, TODO, plan, or source files. Used to build full context before self-healing or global thinking.",
  inputSchema: z.object({
    rootPath: z.string().describe("Root directory to scan (e.g. /app or /workspace/Discord-AIBot)"),
    types: z.enum(["markdown", "todo", "plan", "all", "source"]).default("all"),
    includeContent: z.boolean().default(true).describe("Include file content in results"),
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  const files = await scanProjectFiles(params.rootPath, params.types, params.includeContent);
  const summary = files.map((f) => ({
    path: f.relativePath,
    size: f.size,
    modified: f.modified,
    content: params.includeContent ? f.content?.slice(0, 2000) : undefined,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ total: files.length, files: summary }, null, 2) }] };
});

server.registerTool("read_source_file", {
  title: "Read Source File",
  description: "Read the content of a specific source file (TypeScript, JavaScript, JSON, etc.).",
  inputSchema: z.object({ filePath: z.string().describe("Absolute path to the file") }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  try {
    const content = await readSourceFile(params.filePath);
    return { content: [{ type: "text" as const, text: content }] };
  } catch (err) {
    return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
  }
});

server.registerTool("analyze_and_refactor", {
  title: "Analyze & Refactor Bot Code",
  description: "Analyze a source file for issues: hardcoded tokens, unhandled promises, TypeScript 'any', TODO comments, and more. Returns actionable refactor suggestions.",
  inputSchema: z.object({
    filePath: z.string().describe("Absolute path to the file to analyze"),
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  try {
    const suggestions = await analyzeSourceFile(params.filePath);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          file: params.filePath,
          issueCount: suggestions.length,
          critical: suggestions.filter((s) => s.severity === "critical").length,
          warnings: suggestions.filter((s) => s.severity === "warning").length,
          info: suggestions.filter((s) => s.severity === "info").length,
          suggestions,
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
  }
});

server.registerTool("format_data", {
  title: "Format Data",
  description: "Format/transform data between representations: json, yaml, table (markdown), markdown, or summary.",
  inputSchema: z.object({
    data: z.unknown().describe("Data to format (any JSON-serializable value)"),
    format: z.enum(["json", "yaml", "table", "markdown", "summary"]).default("json"),
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  const formatted = formatData(params.data, params.format);
  return { content: [{ type: "text" as const, text: formatted }] };
});

// ═══════════════════════════════════════════════════════════════════
// SELF-HEALING TOOLS
// ═══════════════════════════════════════════════════════════════════

server.registerTool("diagnose_discord_client", {
  title: "Diagnose Discord Client",
  description: "Run a full health check on a Discord bot container: token validation, container status, log error extraction, and actionable recommendations.",
  inputSchema: z.object({
    clientName: z.enum(["discord-aibot", "calm-discord-bot", "overmoderator", "airhornbot"]).describe("Which Discord client to diagnose"),
    token: z.string().optional().describe("Override bot token (uses DISCORD_BOT_TOKEN env var by default)"),
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (params) => {
  const result = await diagnoseClient(params.clientName, params.token);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("predict_discord_state", {
  title: "Predict Discord Client Future State",
  description: "Analyse current telemetry and predict the Discord client's state in the next N hours. Returns risk level, predicted issues, and preventive actions.",
  inputSchema: z.object({
    clientName: z.enum(["discord-aibot", "calm-discord-bot", "overmoderator", "airhornbot"]),
    lookAheadHours: z.number().int().min(1).max(168).default(24),
    token: z.string().optional(),
  }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (params) => {
  const result = await predictClientState(params.clientName, params.lookAheadHours, params.token);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("restart_discord_client", {
  title: "Restart Discord Client Container",
  description: "Restart a Discord bot Docker container. Use when diagnose recommends a restart.",
  inputSchema: z.object({
    clientName: z.enum(["discord-aibot", "calm-discord-bot", "overmoderator", "airhornbot"]),
  }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (params) => {
  const result = restartContainer(params.clientName);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

server.registerTool("list_containers", {
  title: "List All Docker Containers",
  description: "List all Docker containers (running and stopped) with their status and image.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async () => {
  const output = listAllContainers();
  return { content: [{ type: "text" as const, text: output || "No containers found or Docker not accessible" }] };
});

// ═══════════════════════════════════════════════════════════════════
// GLOBAL SEQUENTIAL THINKING
// ═══════════════════════════════════════════════════════════════════

server.registerTool("global_sequential_thinking", {
  title: "Global Sequential Thinking Across All Discord Clients",
  description: `Run a coordinated sequential thinking chain across ALL Discord clients simultaneously.
Gathers telemetry from every client, identifies systemic patterns, performs cross-client root cause analysis,
and derives a universal fix strategy. Use when a single client cannot self-heal or when multiple clients
are experiencing correlated issues. Returns a full multi-step reasoning chain with conclusions.`,
  inputSchema: z.object({
    goal: z.string().min(1).describe("What to achieve or diagnose across all clients"),
    clients: z.array(z.enum(["discord-aibot", "calm-discord-bot", "overmoderator", "airhornbot"])).optional().describe("Specific clients to include (defaults to all)"),
    token: z.string().optional().describe("Bot token for token validation across clients"),
  }).strict(),
}, async (params) => {
  const result = await runGlobalSequentialThinking(params.goal, params.clients, params.token);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
});

// ── Boot ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sequential Thinking MCP server v2.0 running — Discord + self-healing + global thinking enabled");
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
