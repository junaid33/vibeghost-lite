"use client";

import {
  Component,
  createElement,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import AgentScreen from "@/components/beautiful-ui/primitives/AgentScreen";
import ApprovalCard from "@/components/beautiful-ui/primitives/ApprovalCard";
import ChatComposer from "@/components/beautiful-ui/primitives/ChatComposer";
import CodeBlock from "@/components/beautiful-ui/primitives/CodeBlock";
import ContextCards from "@/components/beautiful-ui/primitives/ContextCards";
import DiffTable from "@/components/beautiful-ui/primitives/DiffTable";
import FilterTable from "@/components/beautiful-ui/primitives/FilterTable";
import FineTuneCard from "@/components/beautiful-ui/primitives/FineTuneCard";
import Flowchart from "@/components/beautiful-ui/primitives/Flowchart";
import InsightCards from "@/components/beautiful-ui/primitives/InsightCards";
import LoadingState from "@/components/beautiful-ui/primitives/LoadingState";
import PromptBar from "@/components/beautiful-ui/primitives/PromptBar";
import RecommendationCard from "@/components/beautiful-ui/primitives/RecommendationCard";
import RecordsTable from "@/components/beautiful-ui/primitives/RecordsTable";
import SearchList from "@/components/beautiful-ui/primitives/SearchList";
import SelectionActions from "@/components/beautiful-ui/primitives/SelectionActions";
import SidebarNav from "@/components/beautiful-ui/primitives/SidebarNav";
import StreamingText from "@/components/beautiful-ui/primitives/StreamingText";
import TaskRows from "@/components/beautiful-ui/primitives/TaskRows";
import ThinkingState from "@/components/beautiful-ui/primitives/ThinkingState";
import ToolChips, {
  type ToolStep,
} from "@/components/beautiful-ui/primitives/ToolChips";

export const BEAUTIFUL_UI_COMPONENTS = [
  "loading-state",
  "thinking",
  "streaming-text",
  "approval-card",
  "tool-chips",
  "task-rows",
  "chat",
  "prompt-bar",
  "recommendation-card",
  "context-cards",
  "diff-table",
  "records-table",
  "filter-table",
  "sidebar-nav",
  "search",
  "flowchart",
  "insight-cards",
  "code-block",
  "fine-tune-card",
  "selection-actions",
  "agent-screen",
] as const;

export type BeautifulUiComponentName =
  (typeof BEAUTIFUL_UI_COMPONENTS)[number];

export type BeautifulUiArtifact = {
  component: BeautifulUiComponentName;
  props?: Record<string, unknown>;
};

export type PiSemanticTool = {
  name: string;
  arguments?: string;
  result?: string;
  isError?: boolean;
  status?: string;
  truncated?: boolean;
};

const componentRegistry: Record<
  BeautifulUiComponentName,
  ComponentType<Record<string, unknown>>
> = {
  "loading-state": LoadingState as unknown as ComponentType<Record<string, unknown>>,
  thinking: ThinkingState as unknown as ComponentType<Record<string, unknown>>,
  "streaming-text": StreamingText as unknown as ComponentType<Record<string, unknown>>,
  "approval-card": ApprovalCard as unknown as ComponentType<Record<string, unknown>>,
  "tool-chips": ToolChips as unknown as ComponentType<Record<string, unknown>>,
  "task-rows": TaskRows as unknown as ComponentType<Record<string, unknown>>,
  chat: ChatComposer as unknown as ComponentType<Record<string, unknown>>,
  "prompt-bar": PromptBar as unknown as ComponentType<Record<string, unknown>>,
  "recommendation-card": RecommendationCard as unknown as ComponentType<Record<string, unknown>>,
  "context-cards": ContextCards as unknown as ComponentType<Record<string, unknown>>,
  "diff-table": DiffTable as unknown as ComponentType<Record<string, unknown>>,
  "records-table": RecordsTable as unknown as ComponentType<Record<string, unknown>>,
  "filter-table": FilterTable as unknown as ComponentType<Record<string, unknown>>,
  "sidebar-nav": SidebarNav as unknown as ComponentType<Record<string, unknown>>,
  search: SearchList as unknown as ComponentType<Record<string, unknown>>,
  flowchart: Flowchart as unknown as ComponentType<Record<string, unknown>>,
  "insight-cards": InsightCards as unknown as ComponentType<Record<string, unknown>>,
  "code-block": CodeBlock as unknown as ComponentType<Record<string, unknown>>,
  "fine-tune-card": FineTuneCard as unknown as ComponentType<Record<string, unknown>>,
  "selection-actions": SelectionActions as unknown as ComponentType<Record<string, unknown>>,
  "agent-screen": AgentScreen as unknown as ComponentType<Record<string, unknown>>,
};

class ArtifactBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Beautiful UI artifact could not be rendered", error, info);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function isComponentName(value: unknown): value is BeautifulUiComponentName {
  return (
    typeof value === "string" &&
    (BEAUTIFUL_UI_COMPONENTS as readonly string[]).includes(value)
  );
}

function asArtifact(value: unknown): BeautifulUiArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isComponentName(record.component)) return null;
  return {
    component: record.component,
    props:
      record.props && typeof record.props === "object" && !Array.isArray(record.props)
        ? (record.props as Record<string, unknown>)
        : undefined,
  };
}

export function extractBeautifulUiArtifacts(text?: string) {
  if (!text) return { text: "", artifacts: [] as BeautifulUiArtifact[] };

  const artifacts: BeautifulUiArtifact[] = [];
  const visibleText = text.replace(
    /```beautiful-ui\s*\n([\s\S]*?)```/gi,
    (_match, source: string) => {
      try {
        const parsed: unknown = JSON.parse(source.trim());
        const values = Array.isArray(parsed) ? parsed : [parsed];
        for (const value of values) {
          const artifact = asArtifact(value);
          if (artifact) artifacts.push(artifact);
        }
        return "";
      } catch {
        return _match;
      }
    },
  );

  return { text: visibleText.trim(), artifacts };
}

export function extractBeautifulUiToolArtifacts(tools?: PiSemanticTool[]) {
  if (!tools?.length) return [];
  const artifacts: BeautifulUiArtifact[] = [];
  for (const tool of tools) {
    const candidates = [tool.result, tool.arguments];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed: unknown = JSON.parse(candidate);
        const record =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
        const payload = record?.beautifulUi ?? record?.beautiful_ui ?? parsed;
        const values = Array.isArray(payload) ? payload : [payload];
        for (const value of values) {
          const artifact = asArtifact(value);
          if (artifact) artifacts.push(artifact);
        }
      } catch {
        // Ordinary tool output is not expected to be JSON UI data.
      }
    }
  }
  return artifacts;
}

export function BeautifulUiArtifactView({
  artifact,
}: {
  artifact: BeautifulUiArtifact;
}) {
  const Renderer = componentRegistry[artifact.component];
  return (
    <ArtifactBoundary>
      <div
        className="my-3 flex min-w-0 max-w-full justify-start overflow-x-auto py-1 [&>*]:max-w-full"
        data-beautiful-ui={artifact.component}
      >
        {createElement(Renderer, artifact.props ?? {})}
      </div>
    </ArtifactBoundary>
  );
}

function parseRecord(value?: string) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function firstLine(value?: string) {
  const line = value?.split("\n").find((entry) => entry.trim())?.trim() ?? "";
  return line.length > 92 ? `${line.slice(0, 89)}…` : line;
}

function toolDescriptor(tool: PiSemanticTool): ToolStep {
  const args = parseRecord(tool.arguments);
  const lower = tool.name.toLowerCase();
  const path = typeof args?.path === "string" ? args.path : "";
  const command = typeof args?.command === "string" ? firstLine(args.command) : "";
  const query = typeof args?.query === "string" ? firstLine(args.query) : "";
  const failed = tool.isError === true;

  if (lower === "read") {
    return {
      icon: "read",
      label: failed ? "Could not read" : "Read",
      chip: path || "file",
      mono: true,
      detailMono: false,
      detail: [{ text: failed ? "Read failed" : "File inspected" }],
    };
  }
  if (lower === "edit" || lower === "write") {
    return {
      icon: "write",
      label: failed ? "Edit failed" : lower === "edit" ? "Edited" : "Wrote",
      chip: path || "file",
      mono: true,
      detailMono: false,
      detail: [{ text: failed ? "The change was not applied" : "Change applied" }],
    };
  }
  if (lower === "bash") {
    return {
      icon: "run",
      label: failed ? "Command failed" : "Ran command",
      chip: command || "shell",
      mono: true,
      detailMono: true,
      detail: [{ text: failed ? "Exited with an error" : "Command completed" }],
    };
  }
  if (lower.includes("search")) {
    return {
      icon: "think",
      label: failed ? "Search failed" : "Searched",
      chip: query || tool.name.replaceAll("_", " "),
      mono: false,
      detailMono: false,
      detail: [{ text: failed ? "No results returned" : "Search completed" }],
    };
  }
  return {
    icon: "think",
    label: failed ? `${tool.name} failed` : tool.name.replaceAll("_", " "),
    chip: tool.status === "running" ? "Running…" : "Done",
    mono: false,
    detailMono: false,
    detail: [{ text: failed ? "Tool failed" : "Tool completed" }],
  };
}

export function PiToolRun({ tools }: { tools: PiSemanticTool[] }) {
  if (!tools.length) return null;
  const hiddenCount = Math.max(0, tools.length - 8);
  const steps = tools.slice(-8).map(toolDescriptor);
  const running = tools.some((tool) => tool.status === "running");
  const failed = tools.filter((tool) => tool.isError).length;
  const label = `${tools.length} tool ${tools.length === 1 ? "call" : "calls"}${failed ? `, ${failed} failed` : ""}`;

  return (
    <div className="my-1 max-w-full">
      <ToolChips
        steps={steps}
        diffs={[]}
        animated={false}
        compact
        defaultOpen={false}
        labels={{
          header: running ? `${label}, working` : label,
          more: hiddenCount ? `+${hiddenCount} earlier` : "",
        }}
        className="min-h-0 max-w-full"
      />
    </div>
  );
}
