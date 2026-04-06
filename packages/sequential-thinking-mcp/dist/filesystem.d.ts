/**
 * Filesystem utilities for scanning project files,
 * reading markdown/TODO/plan docs, and refactoring bot code.
 */
export interface FileEntry {
    path: string;
    relativePath: string;
    size: number;
    modified: string;
    content?: string;
}
export declare function scanProjectFiles(rootPath: string, types: "markdown" | "todo" | "plan" | "all" | "source", includeContent?: boolean): Promise<FileEntry[]>;
export declare function readSourceFile(filePath: string): Promise<string>;
export interface RefactorSuggestion {
    file: string;
    line?: number;
    issue: string;
    suggestion: string;
    severity: "info" | "warning" | "critical";
}
export declare function analyzeSourceFile(filePath: string): Promise<RefactorSuggestion[]>;
export declare function formatData(data: unknown, format: "json" | "yaml" | "table" | "markdown" | "summary"): string;
//# sourceMappingURL=filesystem.d.ts.map