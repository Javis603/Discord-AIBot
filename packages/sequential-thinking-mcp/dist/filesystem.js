/**
 * Filesystem utilities for scanning project files,
 * reading markdown/TODO/plan docs, and refactoring bot code.
 */
import fs from "node:fs/promises";
import path from "node:path";
const TEXT_EXTS = new Set([".ts", ".js", ".json", ".md", ".yaml", ".yml", ".env.example", ".txt", ".sh"]);
const MAX_READ_BYTES = 64 * 1024; // 64 KB per file
async function walk(dir, filter, results = []) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    }
    catch {
        return results;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const skip = ["node_modules", ".git", "dist", ".next", "coverage", "__pycache__"];
            if (!skip.includes(entry.name)) {
                await walk(full, filter, results);
            }
        }
        else if (entry.isFile() && filter(full)) {
            results.push(full);
        }
    }
    return results;
}
// ── Scan project files ────────────────────────────────────────────────
export async function scanProjectFiles(rootPath, types, includeContent = true) {
    const filter = (f) => {
        const base = path.basename(f).toLowerCase();
        const ext = path.extname(f).toLowerCase();
        if (types === "markdown")
            return ext === ".md";
        if (types === "todo")
            return base.includes("todo") || base.includes("task");
        if (types === "plan")
            return base.includes("plan") || base.includes("deployment") || base.includes("checklist");
        if (types === "source")
            return [".ts", ".js"].includes(ext);
        // all: markdown + todo + plan files
        return ext === ".md" || base.includes("todo") || base.includes("plan");
    };
    const files = await walk(rootPath, filter);
    const entries = [];
    for (const f of files) {
        try {
            const stat = await fs.stat(f);
            const entry = {
                path: f,
                relativePath: path.relative(rootPath, f),
                size: stat.size,
                modified: stat.mtime.toISOString(),
            };
            if (includeContent && TEXT_EXTS.has(path.extname(f).toLowerCase())) {
                const raw = await fs.readFile(f);
                entry.content = raw.slice(0, MAX_READ_BYTES).toString("utf8");
                if (raw.length > MAX_READ_BYTES) {
                    entry.content += `\n...[truncated at ${MAX_READ_BYTES} bytes]`;
                }
            }
            entries.push(entry);
        }
        catch {
            // skip unreadable files
        }
    }
    return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
// ── Read a single file ────────────────────────────────────────────────
export async function readSourceFile(filePath) {
    try {
        const raw = await fs.readFile(filePath);
        let content = raw.slice(0, MAX_READ_BYTES).toString("utf8");
        if (raw.length > MAX_READ_BYTES) {
            content += `\n...[truncated at ${MAX_READ_BYTES} bytes]`;
        }
        return content;
    }
    catch (err) {
        throw new Error(`Cannot read ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    }
}
export async function analyzeSourceFile(filePath) {
    const content = await readSourceFile(filePath);
    const lines = content.split("\n");
    const suggestions = [];
    lines.forEach((line, i) => {
        const ln = i + 1;
        const trimmed = line.trim();
        // Detect hardcoded tokens
        if (/[A-Za-z0-9]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/.test(line)) {
            suggestions.push({ file: filePath, line: ln, severity: "critical", issue: "Hardcoded Discord token detected", suggestion: "Move to .env and use process.env.DISCORD_TOKEN" });
        }
        // Detect console.log in production code
        if (trimmed.startsWith("console.log(") && !filePath.includes("test")) {
            suggestions.push({ file: filePath, line: ln, severity: "info", issue: "console.log in production code", suggestion: "Replace with structured logger (winston/pino)" });
        }
        // Detect any/unknown types in TS
        if (/:\s*any\b/.test(line) && filePath.endsWith(".ts")) {
            suggestions.push({ file: filePath, line: ln, severity: "warning", issue: "TypeScript 'any' type used", suggestion: "Replace with specific type or 'unknown'" });
        }
        // Detect unhandled promise
        if (/\.then\(/.test(line) && !lines[i + 1]?.includes(".catch(") && !lines[i + 1]?.includes("catch")) {
            suggestions.push({ file: filePath, line: ln, severity: "warning", issue: "Promise chain without .catch()", suggestion: "Add .catch() handler or use async/await with try/catch" });
        }
        // TODO comments
        if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(trimmed)) {
            suggestions.push({ file: filePath, line: ln, severity: "info", issue: trimmed, suggestion: "Address this TODO/FIXME before production" });
        }
    });
    return suggestions;
}
// ── Format data ───────────────────────────────────────────────────────
export function formatData(data, format) {
    if (format === "json") {
        return JSON.stringify(data, null, 2);
    }
    if (format === "summary") {
        if (Array.isArray(data)) {
            return `Array of ${data.length} items.\nFirst item keys: ${Object.keys(data[0] ?? {}).join(", ")}`;
        }
        if (typeof data === "object" && data !== null) {
            const keys = Object.keys(data);
            return `Object with ${keys.length} keys: ${keys.join(", ")}`;
        }
        return String(data);
    }
    if (format === "table") {
        if (!Array.isArray(data) || data.length === 0)
            return "No tabular data";
        const keys = Object.keys(data[0]);
        const header = `| ${keys.join(" | ")} |`;
        const sep = `| ${keys.map(() => "---").join(" | ")} |`;
        const rows = data.map((row) => `| ${keys.map((k) => String(row[k] ?? "")).join(" | ")} |`);
        return [header, sep, ...rows].join("\n");
    }
    if (format === "yaml") {
        // Simple YAML serialiser (no external dep)
        function toYaml(val, indent = 0) {
            const pad = " ".repeat(indent);
            if (val === null || val === undefined)
                return "null";
            if (typeof val === "string")
                return val.includes("\n") ? `|\n${val.split("\n").map((l) => pad + "  " + l).join("\n")}` : val;
            if (typeof val !== "object")
                return String(val);
            if (Array.isArray(val))
                return val.map((v) => `${pad}- ${toYaml(v, indent + 2)}`).join("\n");
            return Object.entries(val)
                .map(([k, v]) => {
                if (typeof v === "object" && v !== null) {
                    return `${pad}${k}:\n${toYaml(v, indent + 2)}`;
                }
                return `${pad}${k}: ${toYaml(v, indent + 2)}`;
            })
                .join("\n");
        }
        return toYaml(data);
    }
    if (format === "markdown") {
        if (Array.isArray(data)) {
            return data.map((item, i) => `### Item ${i + 1}\n${formatData(item, "yaml")}`).join("\n\n");
        }
        return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    }
    return JSON.stringify(data, null, 2);
}
//# sourceMappingURL=filesystem.js.map