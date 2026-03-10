import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import type { Message, Thread } from "@langchain/langgraph-sdk";
import { useEffect } from "react";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const MAX_TITLE_LENGTH = 72;

type ThreadMessage = {
  type?: string;
  content?: unknown;
  tool_calls?: Array<{
    name?: string;
    args?: Record<string, unknown>;
  }>;
};

function sanitizeTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= MAX_TITLE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}

function getMetadataTitle(thread: Thread): string | null {
  if (typeof thread.metadata !== "object" || thread.metadata == null) {
    return null;
  }

  const metadata = thread.metadata as Record<string, unknown>;
  const metadataTitleKeys = ["title", "thread_title", "chat_title"];
  for (const key of metadataTitleKeys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const cleanTitle = sanitizeTitle(value);
      if (cleanTitle) return cleanTitle;
    }
  }

  return null;
}

function getThreadMessages(thread: Thread): ThreadMessage[] {
  if (typeof thread.values !== "object" || thread.values == null) {
    return [];
  }

  const threadValues = thread.values as Record<string, unknown>;
  if (!("messages" in threadValues) || !Array.isArray(threadValues.messages)) {
    return [];
  }

  return threadValues.messages as ThreadMessage[];
}

function getMessageText(content: unknown): string {
  if (typeof content !== "string" && !Array.isArray(content)) {
    return "";
  }
  return sanitizeTitle(getContentString(content as Message["content"]));
}

function getTitleFromToolCall(messages: ThreadMessage[]): string | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (message.type !== "ai" || !Array.isArray(message.tool_calls)) continue;

    for (
      let toolIndex = message.tool_calls.length - 1;
      toolIndex >= 0;
      toolIndex--
    ) {
      const toolCall = message.tool_calls[toolIndex];
      if (toolCall?.name !== "set_chat_title") continue;

      const titleValue = toolCall.args?.title;
      if (typeof titleValue !== "string") continue;

      const cleanTitle = sanitizeTitle(titleValue);
      if (cleanTitle) return cleanTitle;
    }
  }

  return null;
}

function getTitleFromMessages(messages: ThreadMessage[]): string | null {
  for (const message of messages) {
    if (message.type !== "human") continue;
    const title = getMessageText(message.content);
    if (title) return title;
  }

  for (const message of messages) {
    if (message.type !== "ai") continue;
    const title = getMessageText(message.content);
    if (title) return title;
  }

  return null;
}

function deriveThreadTitle(thread: Thread): string {
  const metadataTitle = getMetadataTitle(thread);
  if (metadataTitle) return metadataTitle;

  const messages = getThreadMessages(thread);
  const toolTitle = getTitleFromToolCall(messages);
  if (toolTitle) return toolTitle;

  const messageTitle = getTitleFromMessages(messages);
  if (messageTitle) return messageTitle;

  return thread.thread_id;
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        const itemText = deriveThreadTitle(t);

        return (
          <div
            key={t.thread_id}
            className="w-full px-1"
          >
            <Button
              variant="ghost"
              className="w-[280px] items-start justify-start text-left font-normal"
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">{itemText}</p>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [chatHistoryOpen]);

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r-[1px] border-slate-300 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Thread History
          </h1>
        </div>
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
