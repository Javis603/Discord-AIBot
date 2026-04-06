/**
 * Global Sequential Thinking — coordinates reasoning chains
 * across multiple Discord clients simultaneously.
 * When a single client cannot self-heal, a cross-client analysis
 * is triggered to find the root cause and a universal fix.
 */

import { diagnoseClient, predictClientState } from "./healing.js";
import { createSession, addStep, completeSession } from "./store.js";

export interface ClientState {
  name: string;
  containerStatus: string | null;
  containerHealth: string | null;
  tokenValid: boolean | null;
  errors: string[];
  riskLevel: string;
}

export interface GlobalThinkingResult {
  sessionId: string;
  goal: string;
  clients: string[];
  clientStates: ClientState[];
  steps: GlobalThinkingStep[];
  conclusion: string;
  universalFix: string[];
  completedAt: string;
}

export interface GlobalThinkingStep {
  stepNumber: number;
  title: string;
  content: string;
  confidence: number;
  clients: string[];
  tags: string[];
}

const KNOWN_CLIENTS = [
  "discord-aibot",
  "calm-discord-bot",
  "overmoderator",
  "airhornbot",
];

async function gatherClientStates(clients: string[], token?: string): Promise<ClientState[]> {
  const states = await Promise.all(
    clients.map(async (name) => {
      const diag = await diagnoseClient(name, token);
      const pred = await predictClientState(name, 24, token);
      return {
        name,
        containerStatus: diag.containerStatus,
        containerHealth: diag.containerHealth,
        tokenValid: diag.tokenValid,
        errors: diag.recentErrors,
        riskLevel: pred.riskLevel,
      } satisfies ClientState;
    })
  );
  return states;
}

function analyzePatterns(states: ClientState[]): string[] {
  const patterns: string[] = [];

  const allDown = states.filter((s) => s.containerStatus === "exited" || s.containerStatus === "not found");
  if (allDown.length === states.length) {
    patterns.push("ALL_CLIENTS_DOWN: Network-level or infrastructure failure — not bot-specific");
  } else if (allDown.length > 0) {
    patterns.push(`PARTIAL_OUTAGE: ${allDown.map((s) => s.name).join(", ")} are down`);
  }

  const tokenFailures = states.filter((s) => s.tokenValid === false);
  if (tokenFailures.length > 0) {
    patterns.push(`TOKEN_FAILURE: ${tokenFailures.map((s) => s.name).join(", ")} have invalid tokens`);
  }

  const sharedErrors = findSharedErrors(states);
  if (sharedErrors.length > 0) {
    patterns.push(`SHARED_ERRORS: ${sharedErrors.join("; ")} — systemic issue`);
  }

  const highRisk = states.filter((s) => s.riskLevel === "critical" || s.riskLevel === "high");
  if (highRisk.length >= 2) {
    patterns.push(`MULTI_CLIENT_RISK: ${highRisk.map((s) => s.name).join(", ")} at high/critical risk`);
  }

  return patterns;
}

function findSharedErrors(states: ClientState[]): string[] {
  if (states.length < 2) return [];
  const errorSets = states.map((s) => new Set(s.errors.map((e) => e.slice(0, 50).toLowerCase())));
  const [first, ...rest] = errorSets;
  if (!first) return [];
  return [...first].filter((err) => rest.every((set) => [...set].some((e) => e.includes(err.slice(0, 30)))));
}

function buildUniversalFix(patterns: string[], states: ClientState[]): string[] {
  const fixes: string[] = [];

  if (patterns.some((p) => p.startsWith("ALL_CLIENTS_DOWN"))) {
    fixes.push("Check Docker daemon: `docker ps` — if empty, restart Docker Desktop");
    fixes.push("Check host network: `ping discord.com`");
    fixes.push("Check system resources: `docker stats`");
  }

  if (patterns.some((p) => p.startsWith("TOKEN_FAILURE"))) {
    fixes.push("Regenerate ALL bot tokens in Discord Developer Portal");
    fixes.push("Update .env files and restart containers: `docker compose down && docker compose up -d`");
  }

  if (patterns.some((p) => p.includes("ECONNREFUSED"))) {
    fixes.push("Start databases: `docker compose up -d postgres mongodb redis`");
    fixes.push("Verify DATABASE_URL and MONGODB_URI in .env files");
  }

  if (patterns.some((p) => p.includes("DISALLOWED INTENTS"))) {
    fixes.push("Enable Privileged Gateway Intents for ALL bots in Discord Developer Portal:");
    fixes.push("  → Message Content Intent, Server Members Intent, Presence Intent");
  }

  const criticalClients = states.filter((s) => s.riskLevel === "critical");
  if (criticalClients.length > 0) {
    fixes.push(`Priority restart: ${criticalClients.map((s) => `docker restart ${s.name}`).join(" && ")}`);
  }

  if (fixes.length === 0) {
    fixes.push("No systemic issues detected — clients appear stable");
    fixes.push("Continue monitoring with sequential health checks every 30 minutes");
  }

  return fixes;
}

export async function runGlobalSequentialThinking(
  goal: string,
  clients?: string[],
  token?: string
): Promise<GlobalThinkingResult> {
  const targetClients = clients ?? KNOWN_CLIENTS;
  const session = createSession();

  // Step 1: Gather all client states
  addStep(session.sessionId, {
    title: "Gather all Discord client states",
    content: `Collecting diagnostics from ${targetClients.length} clients: ${targetClients.join(", ")}`,
    totalSteps: 6,
    confidence: 1.0,
    tags: ["data-gathering", "global"],
  });

  const clientStates = await gatherClientStates(targetClients, token);

  // Step 2: Identify patterns
  addStep(session.sessionId, {
    title: "Identify cross-client patterns",
    content: `Analysing ${clientStates.length} client states for shared failure patterns, systemic issues, and correlated errors.`,
    totalSteps: 6,
    confidence: 0.9,
    tags: ["analysis", "patterns"],
  });

  const patterns = analyzePatterns(clientStates);

  // Step 3: Risk assessment
  const criticalCount = clientStates.filter((s) => s.riskLevel === "critical").length;
  const highCount = clientStates.filter((s) => s.riskLevel === "high").length;
  addStep(session.sessionId, {
    title: "Cross-client risk assessment",
    content: [
      `Critical clients: ${criticalCount}`,
      `High-risk clients: ${highCount}`,
      `Patterns detected: ${patterns.length > 0 ? patterns.join("; ") : "none"}`,
      `Goal: ${goal}`,
    ].join("\n"),
    totalSteps: 6,
    confidence: 0.85,
    tags: ["risk-assessment", "global"],
  });

  // Step 4: Root cause analysis
  const rootCauses = patterns.length > 0
    ? `Systemic causes: ${patterns.join("; ")}`
    : "No systemic root cause — issues are client-specific";
  addStep(session.sessionId, {
    title: "Root cause analysis",
    content: rootCauses,
    totalSteps: 6,
    confidence: 0.8,
    tags: ["root-cause", "analysis"],
  });

  // Step 5: Universal fix
  const universalFix = buildUniversalFix(patterns, clientStates);
  addStep(session.sessionId, {
    title: "Derive universal fix strategy",
    content: universalFix.join("\n"),
    totalSteps: 6,
    confidence: 0.85,
    tags: ["fix", "action"],
  });

  // Step 6: Conclusion
  const healthyCount = clientStates.filter((s) => s.containerStatus === "running").length;
  const conclusion = [
    `Global analysis of ${targetClients.length} Discord clients complete.`,
    `${healthyCount}/${targetClients.length} clients are running.`,
    patterns.length > 0
      ? `Systemic issues found: ${patterns.join("; ")}`
      : "No systemic issues — clients are independently isolated.",
    `Universal fix: ${universalFix[0]}`,
  ].join(" ");

  addStep(session.sessionId, {
    title: "Global conclusion",
    content: conclusion,
    totalSteps: 6,
    confidence: 0.88,
    tags: ["conclusion", "global"],
  });

  completeSession(session.sessionId, conclusion);

  const steps: GlobalThinkingStep[] = [
    { stepNumber: 1, title: "Gather client states", content: `Collected from: ${targetClients.join(", ")}`, confidence: 1.0, clients: targetClients, tags: ["data-gathering"] },
    { stepNumber: 2, title: "Pattern identification", content: patterns.join("; ") || "No patterns", confidence: 0.9, clients: targetClients, tags: ["patterns"] },
    { stepNumber: 3, title: "Risk assessment", content: `Critical: ${criticalCount}, High: ${highCount}`, confidence: 0.85, clients: targetClients, tags: ["risk"] },
    { stepNumber: 4, title: "Root cause", content: rootCauses, confidence: 0.8, clients: targetClients, tags: ["root-cause"] },
    { stepNumber: 5, title: "Universal fix", content: universalFix.join("\n"), confidence: 0.85, clients: targetClients, tags: ["fix"] },
    { stepNumber: 6, title: "Conclusion", content: conclusion, confidence: 0.88, clients: targetClients, tags: ["conclusion"] },
  ];

  return {
    sessionId: session.sessionId,
    goal,
    clients: targetClients,
    clientStates,
    steps,
    conclusion,
    universalFix,
    completedAt: new Date().toISOString(),
  };
}
