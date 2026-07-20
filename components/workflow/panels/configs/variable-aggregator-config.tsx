"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, ArrowDown, ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"
import { VarType } from "../../types"

interface AggregationSource {
  id: string
  variable: string
  alias?: string
}

interface VariableAggregatorData {
  sources: AggregationSource[]
  outputVariable: string
  outputType: VarType
  aggregationMethod: "collect" | "merge" | "concat" | "union" | "intersect"
  deduplication?: boolean
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

const AGGREGATION_METHODS = [
  { value: "collect", label: "Collect", description: "Gather all values into an array" },
  { value: "merge", label: "Merge Objects", description: "Combine objects into one (later overwrites earlier)" },
  { value: "concat", label: "Concatenate", description: "Join arrays end-to-end" },
  { value: "union", label: "Union", description: "Combine arrays, removing duplicates" },
  { value: "intersect", label: "Intersect", description: "Keep only common elements" },
]

export function VariableAggregatorConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data as unknown as VariableAggregatorData) || { sources: [] }
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<VariableAggregatorData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates } as unknown as import('../../types').NodeConfig,
    })
  }

  const sources = data.sources || []

  const addSource = () => {
    const newSource: AggregationSource = {
      id: `src_${Date.now()}`,
      variable: "",
    }
    updateData({ sources: [...sources, newSource] })
  }

  const updateSource = (id: string, updates: Partial<AggregationSource>) => {
    updateData({
      sources: sources.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })
  }

  const removeSource = (id: string) => {
    updateData({ sources: sources.filter((s) => s.id !== id) })
  }

  return (
    <div className="space-y-6">
      {/* Source Variables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Source Variables</Label>
          <Button variant="outline" size="sm" onClick={addSource}>
            <Plus className="mr-1 h-3 w-3" />
            Add Source
          </Button>
        </div>

        {sources.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Add variables to aggregate from upstream nodes.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addSource}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add First Source
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div
                key={source.id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                <Badge variant="outline">{index + 1}</Badge>
                <div className="flex flex-1 gap-2">
                  <Input
                    value={source.variable}
                    onChange={(e) =>
                      updateSource(source.id, { variable: e.target.value })
                    }
                    placeholder="Variable name or path..."
                    className="flex-1 font-mono"
                  />
                  <VariableSelector
                    variables={availableVariables}
                    onSelect={(v) =>
                      updateSource(source.id, { variable: `{{${v.name}}}` })
                    }
                  />
                </div>
                <Input
                  value={source.alias || ""}
                  onChange={(e) =>
                    updateSource(source.id, { alias: e.target.value })
                  }
                  placeholder="Alias (optional)"
                  className="w-32"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSource(source.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggregation Arrow */}
      {sources.length > 0 && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <ArrowDown className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Aggregate</span>
          </div>
        </div>
      )}

      {/* Aggregation Method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Aggregation Method</Label>
        <Select
          value={data.aggregationMethod || "collect"}
          onValueChange={(aggregationMethod: VariableAggregatorData["aggregationMethod"]) =>
            updateData({ aggregationMethod })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                <div className="flex flex-col">
                  <span>{method.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {method.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Variable */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Output Variable</Label>
          <Input
            value={data.outputVariable || ""}
            onChange={(e) => updateData({ outputVariable: e.target.value })}
            placeholder="aggregated_result"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Output Type</Label>
          <Select
            value={data.outputType || "array"}
            onValueChange={(value: string) =>
              updateData({ outputType: value as VarType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="array">Array</SelectItem>
              <SelectItem value="object">Object</SelectItem>
              <SelectItem value="string">String</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <span className="font-medium">Advanced Options</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Deduplication */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Remove Duplicates</Label>
              <p className="text-xs text-muted-foreground">
                Remove duplicate values from the result
              </p>
            </div>
            <input
              type="checkbox"
              checked={data.deduplication ?? false}
              onChange={(e) => updateData({ deduplication: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>

          {/* Sorting */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Sort By</Label>
              <Input
                value={data.sortBy || ""}
                onChange={(e) => updateData({ sortBy: e.target.value })}
                placeholder="Field name (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sort Order</Label>
              <Select
                value={data.sortOrder || "asc"}
                onValueChange={(sortOrder: "asc" | "desc") =>
                  updateData({ sortOrder })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Result Preview */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-sm font-medium">Result Preview</Label>
          <div className="mt-2 rounded-lg bg-muted p-3 font-mono text-sm">
            <span className="text-muted-foreground">
              {data.outputVariable || "result"} = {data.aggregationMethod || "collect"}(
              {sources.map((s) => s.alias || s.variable || "...").join(", ")})
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
