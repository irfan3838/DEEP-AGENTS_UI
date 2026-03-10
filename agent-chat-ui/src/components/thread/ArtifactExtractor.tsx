"use client";

import React from "react";
import { useStreamContext } from "@/providers/Stream";
import { useArtifactsContext, getLanguageFromPath, getRenderType } from "@/lib/artifacts-context";
import { Message } from "@langchain/langgraph-sdk";

// ─── Watches the message stream and extracts file artifacts from write_file/edit_file tool calls ──

export function ArtifactExtractor() {
    const { messages } = useStreamContext();
    const { upsertArtifact } = useArtifactsContext();
    // Use a plain mutable ref object to avoid the RefObject<Set> issue
    const seenIds = React.useRef<Set<string>>(new Set<string>());

    React.useEffect(() => {
        const seen = seenIds.current;

        for (const msg of messages) {
            if (msg.type !== "ai") continue;
            const aiMsg = msg as Message & {
                tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
            };
            if (!aiMsg.tool_calls?.length) continue;

            for (const tc of aiMsg.tool_calls) {
                // detect write_file / edit_file calls from deepagents (args: file_path + content)
                if (
                    (tc.name === "write_file" || tc.name === "edit_file") &&
                    typeof tc.args.file_path === "string" &&
                    typeof tc.args.content === "string" &&
                    !seen.has(tc.id)
                ) {
                    seen.add(tc.id);
                    const filePath = tc.args.file_path as string;
                    const content = tc.args.content as string;
                    const filename = filePath.split("/").pop() ?? filePath;
                    upsertArtifact({
                        filePath,
                        filename,
                        content,
                        language: getLanguageFromPath(filePath),
                        renderType: getRenderType(filePath),
                    });
                }
            }
        }
    }, [messages, upsertArtifact]);

    return null;
}
