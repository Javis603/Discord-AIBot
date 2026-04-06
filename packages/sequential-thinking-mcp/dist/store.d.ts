import { ThinkingSession, ThinkingStep } from "./types.js";
export declare function createSession(): ThinkingSession;
export declare function getSession(sessionId?: string): ThinkingSession | null;
export declare function getActiveSession(): ThinkingSession | null;
export declare function addStep(sessionId: string, params: {
    title: string;
    content: string;
    totalSteps: number;
    isRevision?: boolean;
    revisesStep?: number;
    branchFromStep?: number;
    branchId?: string;
    confidence?: number;
    tags?: string[];
}): ThinkingStep | null;
export declare function completeSession(sessionId: string, summary?: string): ThinkingSession | null;
export declare function listSessions(): ThinkingSession[];
//# sourceMappingURL=store.d.ts.map