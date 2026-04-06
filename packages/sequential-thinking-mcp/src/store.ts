import { ThinkingSession, ThinkingStep, SessionStore } from "./types.js";
import { randomUUID } from "node:crypto";

const store: SessionStore = {
  sessions: new Map(),
  activeSessionId: null,
};

export function createSession(): ThinkingSession {
  const session: ThinkingSession = {
    sessionId: randomUUID(),
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
  };
  store.sessions.set(session.sessionId, session);
  store.activeSessionId = session.sessionId;
  return session;
}

export function getSession(sessionId?: string): ThinkingSession | null {
  const id = sessionId ?? store.activeSessionId;
  if (!id) return null;
  return store.sessions.get(id) ?? null;
}

export function getActiveSession(): ThinkingSession | null {
  if (!store.activeSessionId) return null;
  return store.sessions.get(store.activeSessionId) ?? null;
}

export function addStep(
  sessionId: string,
  params: {
    title: string;
    content: string;
    totalSteps: number;
    isRevision?: boolean;
    revisesStep?: number;
    branchFromStep?: number;
    branchId?: string;
    confidence?: number;
    tags?: string[];
  }
): ThinkingStep | null {
  const session = store.sessions.get(sessionId);
  if (!session || session.status !== "active") return null;

  const step: ThinkingStep = {
    id: randomUUID(),
    title: params.title,
    content: params.content,
    stepNumber: session.steps.length + 1,
    totalSteps: params.totalSteps,
    isRevision: params.isRevision ?? false,
    revisesStep: params.revisesStep,
    branchFromStep: params.branchFromStep,
    branchId: params.branchId,
    confidence: params.confidence ?? 0.8,
    tags: params.tags ?? [],
    timestamp: new Date().toISOString(),
  };

  session.steps.push(step);
  session.updatedAt = new Date().toISOString();
  return step;
}

export function completeSession(
  sessionId: string,
  summary?: string
): ThinkingSession | null {
  const session = store.sessions.get(sessionId);
  if (!session) return null;

  session.status = "completed";
  session.summary = summary;
  session.updatedAt = new Date().toISOString();

  if (store.activeSessionId === sessionId) {
    store.activeSessionId = null;
  }

  return session;
}

export function listSessions(): ThinkingSession[] {
  return Array.from(store.sessions.values());
}
