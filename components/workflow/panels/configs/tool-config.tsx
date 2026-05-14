"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Plus, Trash2, Settings2, ChevronDown, Wrench } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface ToolParameter {
  id: string
  name: string
  type: string
  value: string
  required: boolean
}

interface ToolNodeData {
  toolId?: string
  toolName?: string
  toolType?: "builtin" | "custom" | "api"
  parameters: ToolParameter[]
  timeout?: number
  retryOnFailure?: boolean
  retryCount?: number
  outputMapping?: Record<string, string>
}

const BUILTIN_TOOLS = [
  {
    id: "web_search",
    name: "Web Search",
    type: "builtin",
    description: "Search the web using various providers",
    parameters: [
      { name: "query", type: "string", required: true, description: "Search query" },
      { name: "num_results", type: "number", required: false, description: "Number of results" },
      { name: "provider", type: "string", required: false, description: "Search provider" },
    ],
  },
  {
    id: "code_interpreter",
    name: "Code Interpreter",
    type: "builtin",
    description: "Execute Python code in a sandbox",
    parameters: [
      { name: "code", type: "string", required: true, description: "Python code to execute" },
      { name: "timeout", type: "number", required: false, description: "Execution timeout" },
    ],
  },
  {
    id: "file_reader",
    name: "File Reader",
    type: "builtin",
    description: "Read content from files",
    parameters: [
      { name: "file_path", type: "string", required: true, description: "Path or URL to file" },
      { name: "encoding", type: "string", required: false, description: "File encoding" },
    ],
  },
  {
    id: "image_generator",
    name: "Image Generator",
    type: "builtin",
    description: "Generate images using AI models",
    parameters: [
      { name: "prompt", type: "string", required: true, description: "Image description" },
      { name: "size", type: "string", required: false, description: "Image dimensions" },
      { name: "model", type: "string", required: false, description: "Generation model" },
    ],
  },
  {
    id: "email_sender",
    name: "Email Sender",
    type: "builtin",
    description: "Send emails via configured provider",
    parameters: [
      { name: "to", type: "string", required: true, description: "Recipient email" },
      { name: "subject", type: "string", required: true, description: "Email subject" },
      { name: "body", type: "string", required: true, description: "Email body" },
    ],
  },
]

export function ToolConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || { parameters: [] }) as ToolNodeData
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<ToolNodeData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const parameters = data.parameters || []
  const selectedTool = BUILTIN_TOOLS.find((t) => t.id === data.toolId)
  const filteredTools = BUILTIN_TOOLS.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectTool = (toolId: string) => {
    const tool = BUILTIN_TOOLS.find((t) => t.id === toolId)
    if (!tool) return

    const params: ToolParameter[] = tool.parameters.map((p) => ({
      id: `param_${p.name}_${Date.now()}`,
      name: p.name,
      type: p.type,
      value: "",
      required: p.required,
    }))

    updateData({
      toolId,
      toolName: tool.name,
      toolType: tool.type as ToolNodeData["toolType"],
      parameters: params,
    })
  }

  const updateParameter = (id: string, value: string) => {
    updateData({
      parameters: parameters.map((p) =>
        p.id === id ? { ...p, value } : p
      ),
    })
  }

  return (
    <div className="space-y-6">
      {/* Tool Selection */}
      {!data.toolId ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select Tool</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="pl-9"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {filteredTools.map((tool) => (
              <Card
                key={tool.id}
                className="cursor-pointer transition-colors hover:bg-accent"
                onClick={() => selectTool(tool.id)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                  <Badge variant="secondary">{tool.type}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Selected Tool Display */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Wrench className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{data.toolName}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateData({ toolId: undefined, toolName: undefined, parameters: [] })}
                >
                  Change
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {selectedTool?.description}
              </p>
            </CardContent>
          </Card>

          {/* Tool Parameters */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Parameters</Label>
            {parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This tool has no configurable parameters.
              </p>
            ) : (
              <div className="space-y-3">
                {parameters.map((param) => {
                  const paramDef = selectedTool?.parameters.find(
                    (p) => p.name === param.name
                  )
                  return (
                    <div key={param.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">
                          {param.name}
                          {param.required && (
                            <span className="ml-1 text-destructive">*</span>
                          )}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {param.type}
                          </Badge>
                          <VariableSelector
                            variables={availableVariables}
                            onSelect={(v) =>
                              updateParameter(param.id, `{{${v.name}}}`)
                            }
                          />
                        </div>
                      </div>
                      {param.type === "string" && param.name.includes("code") ? (
                        <Textarea
                          value={param.value}
                          onChange={(e) => updateParameter(param.id, e.target.value)}
                          placeholder={paramDef?.description}
                          rows={4}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <Input
                          value={param.value}
                          onChange={(e) => updateParameter(param.id, e.target.value)}
                          placeholder={paramDef?.description}
                          className={param.type === "number" ? "" : ""}
                          type={param.type === "number" ? "number" : "text"}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
              {/* Timeout */}
              <div className="space-y-2">
                <Label className="text-sm">Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={data.timeout || ""}
                  onChange={(e) =>
                    updateData({ timeout: parseInt(e.target.value) || undefined })
                  }
                  placeholder="30"
                />
              </div>

              {/* Retry Settings */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Retry on Failure</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically retry if tool execution fails
                  </p>
                </div>
                <Switch
                  checked={data.retryOnFailure ?? false}
                  onCheckedChange={(retryOnFailure) =>
                    updateData({ retryOnFailure })
                  }
                />
              </div>

              {data.retryOnFailure && (
                <div className="space-y-2">
                  <Label className="text-sm">Retry Count</Label>
                  <Input
                    type="number"
                    value={data.retryCount || 3}
                    onChange={(e) =>
                      updateData({ retryCount: parseInt(e.target.value) || 3 })
                    }
                    min={1}
                    max={10}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  )
}
