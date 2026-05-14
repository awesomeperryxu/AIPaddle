"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import {
  Search,
  ExternalLink,
  GitBranch,
  ChevronDown,
  ArrowRight,
  Settings2,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface InputMapping {
  targetParam: string
  sourceExpression: string
}

interface OutputMapping {
  sourceOutput: string
  targetVariable: string
}

interface SubWorkflowData {
  workflowId?: string
  workflowName?: string
  workflowVersion?: "latest" | "specific"
  specificVersion?: string
  inputMappings: InputMapping[]
  outputMappings: OutputMapping[]
  async?: boolean
  timeout?: number
  onError?: "fail" | "continue" | "retry"
  retryCount?: number
}

// Mock workflows for demo
const AVAILABLE_WORKFLOWS = [
  {
    id: "wf_email_sender",
    name: "Email Notification Workflow",
    description: "Send formatted email notifications",
    inputs: ["recipient", "subject", "content"],
    outputs: ["sent", "messageId"],
    versions: ["1.0.0", "1.1.0", "2.0.0"],
  },
  {
    id: "wf_data_enrichment",
    name: "Data Enrichment Pipeline",
    description: "Enrich data with external sources",
    inputs: ["data", "enrichmentType"],
    outputs: ["enrichedData", "metadata"],
    versions: ["1.0.0"],
  },
  {
    id: "wf_approval",
    name: "Approval Workflow",
    description: "Multi-step approval process",
    inputs: ["requestId", "approvers", "content"],
    outputs: ["approved", "approverComments"],
    versions: ["1.0.0", "1.0.1"],
  },
]

export function SubWorkflowConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data as unknown as SubWorkflowData) || {
    inputMappings: [],
    outputMappings: [],
  }
  const [searchQuery, setSearchQuery] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<SubWorkflowData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates } as unknown as import('../../types').NodeConfig,
    })
  }

  const selectedWorkflow = AVAILABLE_WORKFLOWS.find(
    (w) => w.id === data.workflowId
  )
  const filteredWorkflows = AVAILABLE_WORKFLOWS.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectWorkflow = (workflowId: string) => {
    const workflow = AVAILABLE_WORKFLOWS.find((w) => w.id === workflowId)
    if (!workflow) return

    const inputMappings: InputMapping[] = workflow.inputs.map((input) => ({
      targetParam: input,
      sourceExpression: "",
    }))

    const outputMappings: OutputMapping[] = workflow.outputs.map((output) => ({
      sourceOutput: output,
      targetVariable: output,
    }))

    updateData({
      workflowId,
      workflowName: workflow.name,
      workflowVersion: "latest",
      inputMappings,
      outputMappings,
    })
  }

  const updateInputMapping = (index: number, sourceExpression: string) => {
    const newMappings = [...data.inputMappings]
    newMappings[index] = { ...newMappings[index], sourceExpression }
    updateData({ inputMappings: newMappings })
  }

  const updateOutputMapping = (index: number, targetVariable: string) => {
    const newMappings = [...data.outputMappings]
    newMappings[index] = { ...newMappings[index], targetVariable }
    updateData({ outputMappings: newMappings })
  }

  return (
    <div className="space-y-6">
      {/* Workflow Selection */}
      {!data.workflowId ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select Sub-Workflow</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="pl-9"
            />
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {filteredWorkflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="cursor-pointer transition-colors hover:bg-accent"
                onClick={() => selectWorkflow(workflow.id)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{workflow.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {workflow.description}
                    </p>
                  </div>
                  <Badge variant="outline">
                    v{workflow.versions[workflow.versions.length - 1]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Selected Workflow Display */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <GitBranch className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{data.workflowName}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateData({
                        workflowId: undefined,
                        workflowName: undefined,
                        inputMappings: [],
                        outputMappings: [],
                      })
                    }
                  >
                    Change
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {selectedWorkflow?.description}
              </p>
            </CardContent>
          </Card>

          {/* Version Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Version</Label>
              <Select
                value={data.workflowVersion || "latest"}
                onValueChange={(workflowVersion: "latest" | "specific") =>
                  updateData({ workflowVersion })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="specific">Specific Version</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {data.workflowVersion === "specific" && selectedWorkflow && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Version</Label>
                <Select
                  value={data.specificVersion || selectedWorkflow.versions[0]}
                  onValueChange={(specificVersion) =>
                    updateData({ specificVersion })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedWorkflow.versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        v{v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Input Mappings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Input Mappings</Label>
            <div className="space-y-2">
              {data.inputMappings.map((mapping, index) => (
                <div
                  key={mapping.targetParam}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <Badge variant="secondary" className="font-mono">
                    {mapping.targetParam}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={mapping.sourceExpression}
                    onChange={(e) => updateInputMapping(index, e.target.value)}
                    placeholder="Enter value or variable..."
                    className="flex-1 font-mono"
                  />
                  <VariableSelector
                    variables={availableVariables}
                    onSelect={(v) =>
                      updateInputMapping(index, `{{${v.name}}}`)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Output Mappings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Output Mappings</Label>
            <div className="space-y-2">
              {data.outputMappings.map((mapping, index) => (
                <div
                  key={mapping.sourceOutput}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <Badge variant="outline" className="font-mono">
                    {mapping.sourceOutput}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={mapping.targetVariable}
                    onChange={(e) => updateOutputMapping(index, e.target.value)}
                    placeholder="Variable name..."
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
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
              {/* Async Execution */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Async Execution</Label>
                  <p className="text-xs text-muted-foreground">
                    Run workflow without waiting for result
                  </p>
                </div>
                <Switch
                  checked={data.async ?? false}
                  onCheckedChange={(async_) => updateData({ async: async_ })}
                />
              </div>

              {/* Timeout */}
              {!data.async && (
                <div className="space-y-2">
                  <Label className="text-sm">Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={data.timeout || ""}
                    onChange={(e) =>
                      updateData({
                        timeout: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="300"
                  />
                </div>
              )}

              {/* Error Handling */}
              <div className="space-y-2">
                <Label className="text-sm">On Error</Label>
                <Select
                  value={data.onError || "fail"}
                  onValueChange={(value: string) =>
                    updateData({ onError: value as SubWorkflowData["onError"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fail">Fail workflow</SelectItem>
                    <SelectItem value="continue">Continue execution</SelectItem>
                    <SelectItem value="retry">Retry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.onError === "retry" && (
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
