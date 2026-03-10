"use client";

import React, { useState } from "react";
import {
    FileText, Code2, Globe, Image as ImageIcon_,
    X, ChevronDown, ChevronUp, Clock, RefreshCw,
    FileCode, FileBadge, FileSpreadsheet,
    Copy, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useArtifactsContext, Artifact } from "@/lib/artifacts-context";
import { MarkdownText } from "./markdown-text";
import { SyntaxHighlighter } from "./syntax-highlighter";

// ─── Icon by file type ────────────────────────────────────────────────────────

function FileIcon({ artifact, className }: { artifact: Artifact; className?: string }) {
    const ext = artifact.filename.split(".").pop()?.toLowerCase() ?? "";
    if (artifact.renderType === "markdown") return <FileBadge className={cn("text-blue-400", className)} />;
    if (artifact.renderType === "html") return <Globe className={cn("text-orange-400", className)} />;
    if (artifact.renderType === "image") return <ImageIcon_ className={cn("text-purple-400", className)} />;
    if (["py", "js", "ts", "tsx", "jsx"].includes(ext)) return <FileCode className={cn("text-emerald-400", className)} />;
    if (["csv", "xlsx", "json"].includes(ext)) return <FileSpreadsheet className={cn("text-yellow-400", className)} />;
    return <Code2 className={cn("text-cyan-400", className)} />;
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
}

// ─── Content Renderer ─────────────────────────────────────────────────────────

function ArtifactViewer({ artifact }: { artifact: Artifact }) {
    if (artifact.renderType === "markdown") {
        return (
            <div className="h-full overflow-auto p-4">
                <MarkdownText>{artifact.content}</MarkdownText>
            </div>
        );
    }

    if (artifact.renderType === "html") {
        return (
            <iframe
                key={artifact.id + artifact.updatedAt}
                srcDoc={artifact.content}
                title={artifact.filename}
                className="h-full w-full border-none"
                sandbox="allow-scripts allow-same-origin"
            />
        );
    }

    if (artifact.renderType === "image") {
        // base64 or url
        const src = artifact.content.startsWith("data:")
            ? artifact.content
            : `data:image/png;base64,${artifact.content}`;
        return (
            <div className="flex h-full items-center justify-center bg-zinc-950 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={artifact.filename} className="max-h-full max-w-full object-contain rounded" />
            </div>
        );
    }

    // code / text
    return (
        <div className="h-full overflow-auto">
            <SyntaxHighlighter language={artifact.language}>
                {artifact.content}
            </SyntaxHighlighter>
        </div>
    );
}

// ─── Artifact List Item ───────────────────────────────────────────────────────

function ArtifactListItem({
    artifact,
    isSelected,
    onSelect,
}: {
    artifact: Artifact;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const [tick, setTick] = useState(0);

    // re-render every 30s to keep "time ago" fresh
    React.useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <button
            onClick={onSelect}
            className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                isSelected
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : "hover:bg-gray-100",
            )}
        >
            <FileIcon artifact={artifact} className="h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{artifact.filename}</p>
                <p className="text-xs text-gray-400 font-mono">{artifact.filePath}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {timeAgo(artifact.updatedAt)}
            </div>
        </button>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ArtifactsPanel() {
    const { artifacts, selectedId, panelOpen, selectArtifact, closePanel } =
        useArtifactsContext();
    const [listCollapsed, setListCollapsed] = useState(false);

    if (!panelOpen) return null;

    const selected = artifacts.find((a) => a.id === selectedId) ?? artifacts[artifacts.length - 1];

    const listHeight = listCollapsed ? "2.75rem" : "clamp(8rem, 30%, 16rem)";
    const viewerHeight = listCollapsed ? "calc(100% - 2.75rem)" : "calc(100% - clamp(8rem, 30%, 16rem))";

    return (
        <div className="flex h-full w-full flex-col overflow-hidden bg-white text-gray-900">
            {/* ── Header ── */}
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {selected && <FileIcon artifact={selected} className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate text-sm font-semibold text-gray-800">
                        {selected?.filename ?? "Artifacts"}
                    </span>
                    {selected && (
                        <span className="ml-1 flex-shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                            {selected.language}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {selected && (
                        <>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(selected.content);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => {
                                    const element = document.createElement("a");
                                    const file = new Blob([selected.content], { type: "text/plain" });
                                    element.href = URL.createObjectURL(file);
                                    element.download = selected.filename;
                                    document.body.appendChild(element);
                                    element.click();
                                    document.body.removeChild(element);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                title="Download file"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1" />
                        </>
                    )}
                    <button
                        onClick={closePanel}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                        title="Close artifacts panel"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* ── Viewer ── */}
            <div
                className="overflow-hidden transition-all duration-300"
                style={{ height: viewerHeight, minHeight: 0 }}
            >
                {selected ? (
                    <ArtifactViewer artifact={selected} />
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                        Select an artifact to preview
                    </div>
                )}
            </div>

            {/* ── Artifact List ── */}
            <div
                className="flex flex-col overflow-hidden border-t border-gray-200 transition-all duration-300"
                style={{ height: listHeight }}
            >
                {/* list header */}
                <button
                    onClick={() => setListCollapsed((c) => !c)}
                    className="flex flex-shrink-0 items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-colors"
                >
                    {listCollapsed ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Artifacts
                    <span className="ml-auto rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                        {artifacts.length}
                    </span>
                </button>

                {/* scrollable list */}
                {!listCollapsed && (
                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
                        {artifacts.length === 0 ? (
                            <div className="flex h-full items-center justify-center px-2 py-4 text-center text-xs text-gray-400">
                                No artifacts yet. Generated files will appear here.
                            </div>
                        ) : (
                            [...artifacts].reverse().map((a) => (
                                <ArtifactListItem
                                    key={a.id}
                                    artifact={a}
                                    isSelected={a.id === selectedId}
                                    onSelect={() => selectArtifact(a.id)}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
