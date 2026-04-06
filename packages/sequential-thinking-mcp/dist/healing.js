/**
 * Self-healing and diagnostics for Discord clients.
 * Runs health checks, validates tokens, reads logs, and
 * triggers Docker restarts when needed.
 */
import { execSync, spawnSync } from "node:child_process";
import { validateToken } from "./discord-api.js";
const KNOWN_CONTAINERS = {
    "discord-aibot": "discord-aibot",
    "calm-discord-bot": "calm-discord-bot",
    "overmoderator": "overmoderator-bot",
    "airhornbot": "airhornbot",
};
function safeExec(cmd) {
    try {
        return execSync(cmd, { encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    catch {
        return "";
    }
}
function getContainerStatus(name) {
    const containerName = KNOWN_CONTAINERS[name] ?? name;
    const status = safeExec(`docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`);
    const health = safeExec(`docker inspect --format='{{.State.Health.Status}}' ${containerName} 2>/dev/null`);
    return {
        status: status || "not found",
        health: health || "none",
    };
}
function getContainerLogs(name, lines = 50) {
    const containerName = KNOWN_CONTAINERS[name] ?? name;
    return safeExec(`docker logs --tail ${lines} ${containerName} 2>&1`);
}
function extractErrors(logs) {
    const errorPatterns = [
        /error[:\s].+/gi,
        /fatal[:\s].+/gi,
        /unhandledrejection.+/gi,
        /exception.+/gi,
        /ECONNREFUSED.+/gi,
        /invalid token/gi,
        /disallowed intents/gi,
        /missing permissions/gi,
    ];
    const errors = [];
    const lines = logs.split("\n");
    for (const line of lines) {
        for (const pattern of errorPatterns) {
            if (pattern.test(line)) {
                errors.push(line.trim().slice(0, 200));
                break;
            }
        }
    }
    return [...new Set(errors)].slice(0, 20);
}
function buildRecommendations(tokenValid, containerStatus, errors) {
    const recs = [];
    if (tokenValid === false) {
        recs.push("CRITICAL: Discord token is invalid or expired — regenerate in Discord Developer Portal");
    }
    if (tokenValid === null) {
        recs.push("WARNING: Could not validate token — check DISCORD_BOT_TOKEN environment variable");
    }
    if (containerStatus === "not found") {
        recs.push("Container not found — run: docker compose up -d");
    }
    if (containerStatus === "exited") {
        recs.push("Container exited — run: docker compose restart <service>");
    }
    if (containerStatus === "restarting") {
        recs.push("Container is crash-looping — check logs: docker logs <container>");
    }
    if (errors.some((e) => /ECONNREFUSED/i.test(e))) {
        recs.push("Database connection refused — ensure PostgreSQL/MongoDB is running and healthy");
    }
    if (errors.some((e) => /disallowed intents/i.test(e))) {
        recs.push("Privileged intents not enabled — enable MESSAGE CONTENT INTENT in Discord Developer Portal");
    }
    if (errors.some((e) => /missing permissions/i.test(e))) {
        recs.push("Bot missing permissions — re-invite bot with correct OAuth2 scopes");
    }
    if (recs.length === 0 && containerStatus === "running") {
        recs.push("Bot appears healthy — no immediate action required");
    }
    return recs;
}
export async function diagnoseClient(clientName, token) {
    const ts = new Date().toISOString();
    const { status, health } = getContainerStatus(clientName);
    const logs = getContainerLogs(clientName);
    const errors = extractErrors(logs);
    let tokenValid = null;
    if (token ?? process.env.DISCORD_BOT_TOKEN) {
        const result = await validateToken(token);
        tokenValid = result.ok;
    }
    const recs = buildRecommendations(tokenValid, status, errors);
    return {
        client: clientName,
        timestamp: ts,
        tokenValid,
        containerStatus: status,
        containerHealth: health,
        recentErrors: errors,
        recommendations: recs,
    };
}
export function restartContainer(clientName) {
    const containerName = KNOWN_CONTAINERS[clientName] ?? clientName;
    const result = spawnSync("docker", ["restart", containerName], {
        encoding: "utf8",
        timeout: 30000,
    });
    return {
        success: result.status === 0,
        output: (result.stdout + result.stderr).trim(),
    };
}
export function listAllContainers() {
    return safeExec("docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Image}}'");
}
export async function predictClientState(clientName, lookAheadHours, token) {
    const { status, health } = getContainerStatus(clientName);
    const logs = getContainerLogs(clientName, 200);
    const errors = extractErrors(logs);
    let tokenValid = null;
    if (token ?? process.env.DISCORD_BOT_TOKEN) {
        const result = await validateToken(token);
        tokenValid = result.ok;
    }
    const predictedIssues = [];
    const preventiveActions = [];
    let riskLevel = "low";
    let confidence = 0.85;
    // Analyse error frequency
    const errorCount = errors.length;
    if (errorCount > 10) {
        riskLevel = "critical";
        predictedIssues.push(`High error rate (${errorCount} errors in recent logs) — crash likely within ${Math.max(1, lookAheadHours / 2)}h`);
        preventiveActions.push("Immediately review logs and restart container");
        confidence = 0.9;
    }
    else if (errorCount > 5) {
        riskLevel = "high";
        predictedIssues.push(`Elevated error rate — degraded performance expected within ${lookAheadHours}h`);
        preventiveActions.push("Schedule maintenance window and review error patterns");
        confidence = 0.8;
    }
    else if (errorCount > 2) {
        riskLevel = "medium";
        predictedIssues.push("Intermittent errors detected — may worsen under load");
        confidence = 0.7;
    }
    if (tokenValid === false) {
        riskLevel = "critical";
        predictedIssues.push("Invalid token — bot will fail to connect on next restart");
        preventiveActions.push("Regenerate Discord bot token immediately");
        confidence = 0.99;
    }
    if (status === "restarting") {
        riskLevel = "critical";
        predictedIssues.push("Container is crash-looping — complete outage imminent");
        preventiveActions.push("Fix underlying crash cause before container can recover");
        confidence = 0.95;
    }
    if (logs.includes("heap out of memory") || logs.includes("ENOMEM")) {
        predictedIssues.push(`Memory exhaustion risk within ${lookAheadHours}h`);
        preventiveActions.push("Increase container memory limit or investigate memory leak");
        if (riskLevel === "low")
            riskLevel = "medium";
    }
    if (predictedIssues.length === 0) {
        predictedIssues.push(`No significant issues predicted in the next ${lookAheadHours}h based on current telemetry`);
        preventiveActions.push("Continue routine monitoring every 30 minutes");
    }
    return {
        client: clientName,
        timestamp: new Date().toISOString(),
        lookAheadHours,
        currentHealth: `${status} / ${health}`,
        riskLevel,
        predictedIssues,
        preventiveActions,
        confidence,
    };
}
//# sourceMappingURL=healing.js.map