import type { AgentQuestionRequest } from "../agent-questions";

export type AgentChatMessageRole = "user" | "assistant" | "tool" | "system";

export type AgentChatImage = {
  data: string;
  mimeType: string;
  src?: string;
};

export type AgentChatPart =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "toolCall";
      name: string;
      arguments?: Record<string, unknown>;
      toolCallId?: string;
      status?: "running" | "done";
      result?: string;
      images?: AgentChatImage[];
      isError?: boolean;
      truncated?: boolean;
      /** A question the agent asked the person (AskUserQuestion). */
      question?: AgentQuestionRequest;
    };

export type AgentChatMessage = {
  id: string;
  role: AgentChatMessageRole;
  text: string;
  timestamp?: string;
  parts?: AgentChatPart[];
  stopReason?: string;
  toolName?: string;
  isError?: boolean;
  pending?: boolean;
  truncated?: boolean;
  images?: AgentChatImage[];
};

export type AgentChatResponse = {
  version?: 1 | 2;
  pagination?: { hasMore: boolean; nextCursor?: string; hasNewer?: boolean; returned?: number; limit?: number };
  diagnostics?: { contentTruncated: boolean; contentChars: number };
  agent: string;
  source: "jsonl" | "app-server";
  sessionPath?: string;
  conversationId?: string;
  mtimeMs?: number;
  sizeBytes?: number;
  messages: AgentChatMessage[];
};
