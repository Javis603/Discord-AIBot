export interface ThinkingStep {
  id: string;
  title: string;
  content: string;
  stepNumber: number;
  totalSteps: number;
  isRevision: boolean;
  revisesStep?: number;
  branchFromStep?: number;
  branchId?: string;
  confidence: number;
  tags: string[];
  timestamp: string;
}

export interface ThinkingSession {
  sessionId: string;
  steps: ThinkingStep[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "completed" | "abandoned";
  summary?: string;
}

export interface SessionStore {
  sessions: Map<string, ThinkingSession>;
  activeSessionId: string | null;
}
