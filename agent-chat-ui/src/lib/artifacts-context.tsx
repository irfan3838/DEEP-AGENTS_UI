"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useState,
} from "react";

export interface Artifact {
    id: string;            // unique per file path
    filePath: string;      // e.g. /report.md
    filename: string;      // e.g. report.md
    content: string;
    language: string;      // for syntax highlight
    renderType: "markdown" | "code" | "html" | "image" | "text";
    updatedAt: number;     // Date.now()
}

interface ArtifactsState {
    artifacts: Artifact[];
    selectedId: string | null;
    panelOpen: boolean;
    selectArtifact: (id: string) => void;
    upsertArtifact: (a: Omit<Artifact, "id" | "updatedAt">) => void;
    openPanel: () => void;
    closePanel: () => void;
}

const ArtifactsContext = createContext<ArtifactsState>(null!);

export function ArtifactsProvider({ children }: { children: React.ReactNode }) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);

    const upsertArtifact = useCallback(
        (a: Omit<Artifact, "id" | "updatedAt">) => {
            // Always create a new entry — never overwrite.
            // If the same filePath has been written before, append a version number to the filename.
            const id = `${a.filePath}::${Date.now()}`;
            setArtifacts((prev) => {
                const samePathCount = prev.filter((x) => x.filePath === a.filePath).length;
                const versionedFilename =
                    samePathCount === 0
                        ? a.filename
                        : `${a.filename} (v${samePathCount + 1})`;
                return [...prev, { ...a, filename: versionedFilename, id, updatedAt: Date.now() }];
            });
            setSelectedId(id);
            setPanelOpen(true);
        },
        [],
    );

    const selectArtifact = useCallback((id: string) => {
        setSelectedId(id);
        setPanelOpen(true);
    }, []);

    return (
        <ArtifactsContext.Provider
            value={{
                artifacts,
                selectedId,
                panelOpen,
                selectArtifact,
                upsertArtifact,
                openPanel: () => setPanelOpen(true),
                closePanel: () => setPanelOpen(false),
            }}
        >
            {children}
        </ArtifactsContext.Provider>
    );
}

export function useArtifactsContext() {
    return useContext(ArtifactsContext);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getLanguageFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        py: "python", js: "javascript", ts: "typescript",
        jsx: "jsx", tsx: "tsx", json: "json", yaml: "yaml", yml: "yaml",
        md: "markdown", sh: "bash", bash: "bash", css: "css", html: "html",
        sql: "sql", rs: "rust", go: "go", java: "java", cpp: "cpp",
        c: "c", cs: "csharp", rb: "ruby", php: "php", swift: "swift",
        kt: "kotlin", r: "r", csv: "text", txt: "text",
    };
    return map[ext] ?? "text";
}

export function getRenderType(filePath: string): Artifact["renderType"] {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "md") return "markdown";
    if (ext === "html" || ext === "htm") return "html";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["txt", "csv"].includes(ext)) return "text";
    return "code";
}
