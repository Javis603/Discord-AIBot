/**
 * Self-healing and diagnostics for Discord clients.
 * Runs health checks, validates tokens, reads logs, and
 * triggers Docker restarts when needed.
 */
export interface DiagnosisResult {
    client: string;
    timestamp: string;
    tokenValid: boolean | null;
    containerStatus: string | null;
    containerHealth: string | null;
    recentErrors: string[];
    recommendations: string[];
    action?: string;
}
export declare function diagnoseClient(clientName: string, token?: string): Promise<DiagnosisResult>;
export declare function restartContainer(clientName: string): {
    success: boolean;
    output: string;
};
export declare function listAllContainers(): string;
export interface PredictionResult {
    client: string;
    timestamp: string;
    lookAheadHours: number;
    currentHealth: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    predictedIssues: string[];
    preventiveActions: string[];
    confidence: number;
}
export declare function predictClientState(clientName: string, lookAheadHours: number, token?: string): Promise<PredictionResult>;
//# sourceMappingURL=healing.d.ts.map