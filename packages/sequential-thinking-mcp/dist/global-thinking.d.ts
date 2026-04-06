/**
 * Global Sequential Thinking — coordinates reasoning chains
 * across multiple Discord clients simultaneously.
 * When a single client cannot self-heal, a cross-client analysis
 * is triggered to find the root cause and a universal fix.
 */
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
export declare function runGlobalSequentialThinking(goal: string, clients?: string[], token?: string): Promise<GlobalThinkingResult>;
//# sourceMappingURL=global-thinking.d.ts.map