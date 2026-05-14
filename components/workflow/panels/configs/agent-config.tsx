"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Plus, Trash2, Wrench, Settings2 } from "lucide-react"
import { ModelSelector } from "../common/model-selector"
import { VariableSelector } from "../common/variable-selector"
import type { WorkflowNode, NodeConfigProps, VariableDefinition } from "../../types"

interface AgentTool {
  id: string
  name: string
  type: "builtin" | "custom" | "workflow"
  enabled: boolean
  config?: Record<string, unknown>
}

interface AgentNodeData {
  model?: string
  systemPrompt?: string
  userPromptTemplate?: string
  tools?: AgentTool[]
  maxIterations?: number
  strategy?: "react" | "function_call" | "cot"
  memoryEnabled?: boolean
  memoryWindowSize?: number
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
}

const BUILTIN_TOOLS = [
  { id: "web_search", name: "Web Search", description: "Search the web for information" },
  { id: "code_interpreter", name: "Code Interpreter", description: "Execute Python code" },
  { id: "file_browser", name: "File Browser", description: "Read and analyze files" },
  { id: "calculator", name: "Calculator", description: "Perform mathematical calculations" },
  { id: "dalle", name: "DALL-E", description: "Generate images from text" },
]

const AGENT_STRATEGIES = [
  { value: "react", label: "ReAct", description: "Reasoning + Acting loop" },
  { value: "function_call", label: "Function Calling", description: "Direct function invocation" },
  { value: "cot", label: "Chain of Thought", description: "Step-by-step reasoning" },
]

export function AgentConfig({ node, onUpdate, availableVariables }: NodeConfigProps) {
  const data = (node.data || {}) as AgentNodeData
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(true)

  const updateData = (updates: Partial<AgentNodeData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const tools = data.tools || []

  const addBuiltinTool = (toolId: string) => {
    const builtinTool = BUILTIN_TOOLS.find((t) => t.id === toolId)
    if (!builtinTool) return

    const newTool: AgentTool = {
      id: `${toolId}_${Date.now()}`,
      name: builtinTool.name,
      type: "builtin",
      enabled: true,
    }
    updateData({ tools: [...tools, newTool] })
  }

  const toggleTool = (toolId: string) => {
    updateData({
      tools: tools.map((t) =>
        t.id === toolId ? { ...t, enabled: !t.enabled } : t
      ),
    })
  }

  const removeTool = (toolId: string) => {
    updateData({ tools: tools.filter((t) => t.id !== toolId) })
  }

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Model</Label>
        <ModelSelector
          value={data.model || ""}
          onChange={(model) => updateData({ model })}
          placeholder="Select agent model..."
        />
      </div>

      {/* Agent Strategy */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Agent Strategy</Label>
        <Select
          value={data.strategy || "react"}
          onValueChange={(strategy: "react" | "function_call" | "cot") =>
            updateData({ strategy })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_STRATEGIES.map((strategy) => (
              <SelectItem key={strategy.value} value={strategy.value}>
                <div className="flex flex-col">
                  <span>{strategy.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {strategy.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">System Prompt</Label>
        <Textarea
          value={data.systemPrompt || ""}
          onChange={(e) => updateData({ systemPrompt: e.target.value })}
          placeholder="Define the agent's role, capabilities, and behavior..."
          rows={4}
          className="font-mono text-sm"
        />
      </div>

      {/* User Prompt Template */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">User Prompt Template</Label>
          <VariableSelector
            variables={availableVariables}
            onSelect={(variable) => {
              const currentPrompt = data.userPromptTemplate || ""
              updateData({
                userPromptTemplate: currentPrompt + `{{${variable.name}}}`,
              })
            }}
          />
        </div>
        <Textarea
          value={data.userPromptTemplate || ""}
          onChange={(e) => updateData({ userPromptTemplate: e.target.value })}
          placeholder="Template for user input. Use {{variable}} for dynamic values..."
          rows={3}
          className="font-mono text-sm"
        />
      </div>

      {/* Tools Section */}
      <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="font-medium">Tools</span>
              <Badge variant="secondary">{tools.length}</Badge>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                toolsOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {/* Enabled Tools */}
          {tools.length > 0 && (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={tool.enabled}
                      onCheckedChange={() => toggleTool(tool.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {tool.type === "builtin" ? "Built-in" : tool.type}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTool(tool.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add Tools */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Add Tool</Label>
            <Select onValueChange={addBuiltinTool}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tool..." />
              </SelectTrigger>
              <SelectContent>
                {BUILTIN_TOOLS.filter(
                  (bt) => !tools.some((t) => t.name === bt.name)
                ).map((tool) => (
                  <SelectItem key={tool.id} value={tool.id}>
                    <div className="flex flex-col">
                      <span>{tool.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tool.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Memory Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Conversation Memory</Label>
          <Switch
            checked={data.memoryEnabled ?? true}
            onCheckedChange={(memoryEnabled) => updateData({ memoryEnabled })}
          />
        </div>
        {data.memoryEnabled !== false && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Memory Window Size: {data.memoryWindowSize || 10} messages
            </Label>
            <Slider
              value={[data.memoryWindowSize || 10]}
              onValueChange={([memoryWindowSize]) =>
                updateData({ memoryWindowSize })
              }
              min={1}
              max={50}
              step={1}
            />
          </div>
        )}
      </div>

      {/* Max Iterations */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Max Iterations: {data.maxIterations || 10}
        </Label>
        <Slider
          value={[data.maxIterations || 10]}
          onValueChange={([maxIterations]) => updateData({ maxIterations })}
          min={1}
          max={50}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of reasoning/action cycles
        </p>
      </div>

      {/* Advanced Settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="font-medium">Advanced Settings</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Temperature */}
          <div className="space-y-2">
            <Label className="text-sm">
              Temperature: {(data.temperature ?? 0.7).toFixed(2)}
            </Label>
            <Slider
              value={[data.temperature ?? 0.7]}
              onValueChange={([temperature]) => updateData({ temperature })}
              min={0}
              max={2}
              step={0.01}
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label className="text-sm">Max Tokens</Label>
            <Input
              type="number"
              value={data.maxTokens || ""}
              onChange={(e) =>
                updateData({ maxTokens: parseInt(e.target.value) || undefined })
              }
              placeholder="Auto"
            />
          </div>

          {/* Stop Sequences */}
          <div className="space-y-2">
            <Label className="text-sm">Stop Sequences</Label>
            <Input
              value={data.stopSequences?.join(", ") || ""}
              onChange={(e) =>
                updateData({
                  stopSequences: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Enter comma-separated sequences..."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
