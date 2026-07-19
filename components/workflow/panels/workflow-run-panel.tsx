"use client";

import { useState } from "react";
import {
  X,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Bot,
  RefreshCw,
  Repeat,
  RotateCcw,
  Circle,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ===== Types =====

interface AgentStep {
  id: string;
  toolName: string;
  input: string;
  output: string;
}

interface IterationItem {
  index: number;
  status: "succeeded" | "failed";
  error?: string;
  durationMs: number;
}

interface LoopRecord {
  iteration: number;
  status: "succeeded" | "failed";
  variables: Record<string, unknown>;
  durationMs: number;
}

interface RetryRecord {
  attempt: number;
  status: "succeeded" | "failed";
  timestamp: string;
  error?: string;
}

interface TraceNode {
  id: string;
  title: string;
  type: string;
  status: "succeeded" | "failed" | "running" | "waiting" | "retry";
  durationMs: number;
  tokens?: number;
  logType?: "agent" | "iteration" | "loop" | "retry" | null;
  agentSteps?: AgentStep[];
  iterationItems?: IterationItem[];
  loopRecords?: LoopRecord[];
  retryRecords?: RetryRecord[];
}

interface WorkflowRunPanelProps {
  status: "running" | "succeeded" | "failed" | "stopped";
  elapsedMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  errorCount?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  errorMessage?: string;
  traceNodes?: TraceNode[];
  onClose?: () => void;
  onStop?: () => void;
  isOpen?: boolean;
}

// ===== Status Helpers =====

const statusConfig = {
  succeeded: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "成功",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    label: "失败",
  },
  running: {
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "运行中",
    animate: true,
  },
  stopped: {
    icon: Circle,
    color: "text-gray-500",
    bgColor: "bg-gray-50",
    label: "已停止",
  },
  waiting: {
    icon: Circle,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
    label: "等待中",
  },
  retry: {
    icon: RotateCcw,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    label: "重试中",
  },
};

function StatusIcon({
  status,
  size = 16,
}: {
  status: keyof typeof statusConfig;
  size?: number;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Icon
      className={cn(
        config.color,
        "animate" in config && config.animate && "animate-spin"
      )}
      size={size}
    />
  );
}

// ===== Result Tab =====

function ResultTab({
  status,
  outputs,
  errorMessage,
}: {
  status: WorkflowRunPanelProps["status"];
  outputs?: Record<string, unknown>;
  errorMessage?: string;
}) {
  if (status === "running") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-blue-600">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <span className="text-sm font-medium">运行中...</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800">执行失败</p>
            <pre className="mt-2 text-xs text-red-700 font-mono whitespace-pre-wrap break-words">
              {errorMessage || "未知错误"}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (status === "stopped") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Circle className="h-8 w-8 mb-3" />
        <span className="text-sm font-medium">执行已停止</span>
      </div>
    );
  }

  // Success - show outputs
  return (
    <div className="p-4 space-y-4">
      {outputs && Object.keys(outputs).length > 0 ? (
        Object.entries(outputs).map(([key, value]) => (
          <OutputItem key={key} name={key} value={value} />
        ))
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          无输出数据
        </div>
      )}
    </div>
  );
}

function OutputItem({ name, value }: { name: string; value: unknown }) {
  const isImage =
    typeof value === "string" &&
    (value.startsWith("data:image") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value));
  const isFile =
    typeof value === "object" &&
    value !== null &&
    "filename" in value &&
    "url" in value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {isImage ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : isFile ? (
          <File className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
      <div className="bg-muted/50 rounded-lg p-3">
        {isImage ? (
          <img
            src={value as string}
            alt={name}
            className="max-w-full h-auto rounded"
          />
        ) : isFile ? (
          <a
            href={(value as { url: string }).url}
            className="text-sm text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {(value as { filename: string }).filename}
          </a>
        ) : typeof value === "object" ? (
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {String(value)}
          </p>
        )}
      </div>
    </div>
  );
}

// ===== Detail Tab =====

function DetailTab({
  status,
  elapsedMs,
  promptTokens,
  completionTokens,
  errorCount,
  errorMessage,
  inputs,
  outputs,
}: {
  status: WorkflowRunPanelProps["status"];
  elapsedMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  errorCount?: number;
  errorMessage?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}) {
  const [inputsOpen, setInputsOpen] = useState(false);
  const [outputsOpen, setOutputsOpen] = useState(false);

  const totalTokens = (promptTokens || 0) + (completionTokens || 0);
  const elapsedSeconds = elapsedMs ? (elapsedMs / 1000).toFixed(2) : "0.00";

  return (
    <div className="p-4 space-y-4">
      {/* Status Row */}
      <div className="flex items-center gap-2">
        <StatusIcon status={status} size={20} />
        <span
          className={cn(
            "text-sm font-medium",
            statusConfig[status]?.color || "text-gray-600"
          )}
        >
          {statusConfig[status]?.label || status}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">耗时</span>
          </div>
          <p className="text-lg font-semibold">{elapsedSeconds}s</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs">总 Token</span>
          </div>
          <p className="text-lg font-semibold">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">提示 Token</div>
          <p className="text-lg font-semibold">
            {(promptTokens || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">补全 Token</div>
          <p className="text-lg font-semibold">
            {(completionTokens || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Error Count */}
      {errorCount && errorCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <span className="text-sm text-orange-700 dark:text-orange-300">
            {errorCount} 个节点发生异常
          </span>
        </div>
      )}

      {/* Error Message */}
      {status === "failed" && errorMessage && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-words">
            {errorMessage}
          </pre>
        </div>
      )}

      {/* Inputs Collapsible */}
      <Collapsible open={inputsOpen} onOpenChange={setInputsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-foreground transition-colors">
          {inputsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          输入数据
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-muted/50 rounded-lg p-3 mt-1">
            {inputs && Object.keys(inputs).length > 0 ? (
              <KeyValueList data={inputs} />
            ) : (
              <span className="text-xs text-muted-foreground">无输入数据</span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Outputs Collapsible */}
      <Collapsible open={outputsOpen} onOpenChange={setOutputsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm font-medium hover:text-foreground transition-colors">
          {outputsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          输出数据
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-muted/50 rounded-lg p-3 mt-1">
            {outputs && Object.keys(outputs).length > 0 ? (
              <KeyValueList data={outputs} />
            ) : (
              <span className="text-xs text-muted-foreground">无输出数据</span>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="text-xs font-mono text-blue-600 flex-shrink-0">
            {key}:
          </span>
          <span className="text-xs font-mono text-muted-foreground break-all">
            {typeof value === "object"
              ? JSON.stringify(value)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ===== Tracing Tab =====

function TracingTab({ traceNodes }: { traceNodes?: TraceNode[] }) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  if (!traceNodes || traceNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <span className="text-sm">暂无追踪数据</span>
      </div>
    );
  }

  return (
    <div className="p-2">
      {traceNodes.map((node) => (
        <TraceNodeItem
          key={node.id}
          node={node}
          isExpanded={expandedNodes.has(node.id)}
          onToggle={() => toggleNode(node.id)}
        />
      ))}
    </div>
  );
}

function TraceNodeItem({
  node,
  isExpanded,
  onToggle,
}: {
  node: TraceNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasLogs =
    node.logType &&
    ((node.logType === "agent" && node.agentSteps?.length) ||
      (node.logType === "iteration" && node.iterationItems?.length) ||
      (node.logType === "loop" && node.loopRecords?.length) ||
      (node.logType === "retry" && node.retryRecords?.length));

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={hasLogs ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
          hasLogs && "hover:bg-muted/50 cursor-pointer",
          !hasLogs && "cursor-default"
        )}
      >
        {/* Expand Arrow */}
        <div className="w-4 h-4 flex items-center justify-center">
          {hasLogs ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : null}
        </div>

        {/* Status Icon */}
        <StatusIcon status={node.status} size={14} />

        {/* Node Title */}
        <span className="text-sm font-medium flex-1 truncate">{node.title}</span>

        {/* Type Badge */}
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-5 font-normal"
        >
          {node.type}
        </Badge>

        {/* Tokens */}
        {node.tokens !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {node.tokens}
          </span>
        )}

        {/* Duration */}
        <span className="text-xs text-muted-foreground tabular-nums min-w-[45px] text-right">
          {node.durationMs}ms
        </span>
      </button>

      {/* Expanded Log Panel */}
      {hasLogs && isExpanded && (
        <div className="px-3 pb-3">
          {node.logType === "agent" && node.agentSteps && (
            <AgentLogPanel steps={node.agentSteps} />
          )}
          {node.logType === "iteration" && node.iterationItems && (
            <IterationLogPanel items={node.iterationItems} />
          )}
          {node.logType === "loop" && node.loopRecords && (
            <LoopLogPanel records={node.loopRecords} />
          )}
          {node.logType === "retry" && node.retryRecords && (
            <RetryLogPanel records={node.retryRecords} />
          )}
        </div>
      )}
    </div>
  );
}

// ===== Log Panels =====

function AgentLogPanel({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
        <Bot className="h-4 w-4" />
        Agent 执行步骤
      </div>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Badge className="h-5 px-1.5 text-[10px] bg-indigo-600">
              {index + 1}
            </Badge>
            <span className="text-sm font-medium">{step.toolName}</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">输入:</p>
            <p className="text-xs font-mono bg-background/50 p-2 rounded">
              {step.input}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">输出:</p>
            <p className="text-xs font-mono bg-background/50 p-2 rounded">
              {step.output}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function IterationLogPanel({ items }: { items: IterationItem[] }) {
  return (
    <div className="border-l-2 border-blue-200 dark:border-blue-800 pl-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
        <RefreshCw className="h-4 w-4" />
        迭代结果（{items.length} 项）
      </div>
      {items.map((item) => (
        <div
          key={item.index}
          className="flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg"
        >
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {item.index + 1}
          </Badge>
          <StatusIcon status={item.status} size={14} />
          {item.error && (
            <span className="text-xs text-red-600 flex-1 truncate">
              {item.error}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {item.durationMs}ms
          </span>
        </div>
      ))}
    </div>
  );
}

function LoopLogPanel({ records }: { records: LoopRecord[] }) {
  return (
    <div className="border-l-2 border-purple-200 dark:border-purple-800 pl-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
        <Repeat className="h-4 w-4" />
        循环记录（{records.length} 次）
      </div>
      {records.map((record) => (
        <div
          key={record.iteration}
          className="flex items-center gap-3 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg"
        >
          <span className="text-xs font-medium">第{record.iteration}次</span>
          <StatusIcon status={record.status} size={14} />
          <span className="text-xs text-muted-foreground font-mono flex-1 truncate">
            {JSON.stringify(record.variables)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {record.durationMs}ms
          </span>
        </div>
      ))}
    </div>
  );
}

function RetryLogPanel({ records }: { records: RetryRecord[] }) {
  return (
    <div className="border-l-2 border-orange-200 dark:border-orange-800 pl-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
        <RotateCcw className="h-4 w-4" />
        重试记录（{records.length} 次）
      </div>
      {records.map((record) => (
        <div
          key={record.attempt}
          className="flex items-center gap-3 px-3 py-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg"
        >
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            第{record.attempt}次
          </Badge>
          <StatusIcon status={record.status} size={14} />
          <span className="text-xs text-muted-foreground">{record.timestamp}</span>
          {record.error && (
            <span className="text-xs text-red-600 flex-1 truncate">
              {record.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== Main Component =====

const tabs = [
  { id: "result", label: "RESULT" },
  { id: "detail", label: "DETAIL" },
  { id: "tracing", label: "TRACING" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function WorkflowRunPanel({
  status,
  elapsedMs,
  promptTokens,
  completionTokens,
  errorCount,
  inputs,
  outputs,
  errorMessage,
  traceNodes,
  onClose,
  onStop,
  isOpen = true,
}: WorkflowRunPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("result");

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[340px] bg-background border-l border-border shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">运行结果</h3>
        <div className="flex items-center gap-1">
          {status === "running" && onStop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStop}
              className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Square className="h-3.5 w-3.5 mr-1 fill-current" />
              停止
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <ScrollArea className="flex-1">
        {activeTab === "result" && (
          <ResultTab
            status={status}
            outputs={outputs}
            errorMessage={errorMessage}
          />
        )}
        {activeTab === "detail" && (
          <DetailTab
            status={status}
            elapsedMs={elapsedMs}
            promptTokens={promptTokens}
            completionTokens={completionTokens}
            errorCount={errorCount}
            errorMessage={errorMessage}
            inputs={inputs}
            outputs={outputs}
          />
        )}
        {activeTab === "tracing" && <TracingTab traceNodes={traceNodes} />}
      </ScrollArea>
    </div>
  );
}

// ===== Demo Export =====

export function WorkflowRunPanelDemo() {
  const [isOpen, setIsOpen] = useState(true);

  const demoData: WorkflowRunPanelProps = {
    status: "succeeded",
    elapsedMs: 3450,
    promptTokens: 512,
    completionTokens: 256,
    errorCount: 0,
    inputs: {
      query: "你好，请帮我分析这份报告",
      file: "report.pdf",
    },
    outputs: {
      answer:
        "根据报告分析，主要有以下几点发现：\n1. 市场增长率达到15%\n2. 用户活跃度提升20%\n3. 建议继续投入研发",
      confidence: 0.95,
    },
    traceNodes: [
      {
        id: "start",
        title: "开始",
        type: "Start",
        status: "succeeded",
        durationMs: 5,
      },
      {
        id: "llm-1",
        title: "LLM 处理",
        type: "LLM",
        status: "succeeded",
        durationMs: 1200,
        tokens: 450,
        logType: "retry",
        retryRecords: [
          {
            attempt: 1,
            status: "failed",
            timestamp: "10:23:45",
            error: "Rate limit exceeded",
          },
          {
            attempt: 2,
            status: "succeeded",
            timestamp: "10:23:47",
          },
        ],
      },
      {
        id: "agent-1",
        title: "Agent 执行",
        type: "Agent",
        status: "succeeded",
        durationMs: 1800,
        tokens: 280,
        logType: "agent",
        agentSteps: [
          {
            id: "step-1",
            toolName: "WebSearch",
            input: "市场分析报告 2024",
            output: "找到 5 条相关结果...",
          },
          {
            id: "step-2",
            toolName: "DocumentParser",
            input: "解析上传的 PDF 文件",
            output: "成功提取 3 页内容",
          },
        ],
      },
      {
        id: "iteration-1",
        title: "批量处理",
        type: "Iteration",
        status: "succeeded",
        durationMs: 400,
        logType: "iteration",
        iterationItems: [
          { index: 0, status: "succeeded", durationMs: 120 },
          { index: 1, status: "succeeded", durationMs: 135 },
          { index: 2, status: "succeeded", durationMs: 145 },
        ],
      },
      {
        id: "end",
        title: "结束",
        type: "End",
        status: "succeeded",
        durationMs: 3,
      },
    ],
    isOpen,
    onClose: () => setIsOpen(false),
    onStop: () => console.log("Stop clicked"),
  };

  return (
    <div className="relative w-full h-[600px] bg-muted/20 border rounded-lg overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        画布区域
      </div>
      <WorkflowRunPanel {...demoData} />
      {!isOpen && (
        <Button
          className="absolute top-4 right-4"
          onClick={() => setIsOpen(true)}
        >
          打开面板
        </Button>
      )}
    </div>
  );
}
