"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { ChevronDown, List, Filter, ArrowUpDown, Slice } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface ListOperationData {
  inputVariable?: string
  operation: "filter" | "map" | "sort" | "slice" | "reduce" | "find" | "group" | "flatten" | "unique" | "reverse"
  expression?: string
  sortField?: string
  sortOrder?: "asc" | "desc"
  sliceStart?: number
  sliceEnd?: number
  groupByField?: string
  reduceInitial?: string
  flattenDepth?: number
  outputVariable?: string
}

const OPERATIONS = [
  { value: "filter", label: "Filter", icon: Filter, description: "Keep items matching condition" },
  { value: "map", label: "Map", icon: List, description: "Transform each item" },
  { value: "sort", label: "Sort", icon: ArrowUpDown, description: "Order items by field" },
  { value: "slice", label: "Slice", icon: Slice, description: "Extract a portion of the list" },
  { value: "reduce", label: "Reduce", icon: List, description: "Combine items into single value" },
  { value: "find", label: "Find", icon: Filter, description: "Get first matching item" },
  { value: "group", label: "Group By", icon: List, description: "Group items by field" },
  { value: "flatten", label: "Flatten", icon: List, description: "Flatten nested arrays" },
  { value: "unique", label: "Unique", icon: List, description: "Remove duplicates" },
  { value: "reverse", label: "Reverse", icon: List, description: "Reverse order" },
]

export function ListOperationConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || { operation: "filter" }) as ListOperationData
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<ListOperationData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates } as unknown as import('../../types').NodeConfig,
    })
  }

  const selectedOp = OPERATIONS.find((op) => op.value === data.operation)

  return (
    <div className="space-y-6">
      {/* Input List Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Input List</Label>
        <div className="flex gap-2">
          <Input
            value={data.inputVariable || ""}
            onChange={(e) => updateData({ inputVariable: e.target.value })}
            placeholder="Select or enter list variable..."
            className="flex-1 font-mono"
          />
          <VariableSelector
            variables={availableVariables.filter((v) => v.type === "array")}
            onSelect={(v) => updateData({ inputVariable: `{{${v.name}}}` })}
          />
        </div>
      </div>

      {/* Operation Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Operation</Label>
        <Select
          value={data.operation}
          onValueChange={(value: string) =>
            updateData({ operation: value as ListOperationData["operation"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                <div className="flex items-center gap-2">
                  <op.icon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{op.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {op.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operation-specific Config */}
      {(data.operation === "filter" || data.operation === "find") && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Condition Expression</Label>
          <Textarea
            value={data.expression || ""}
            onChange={(e) => updateData({ expression: e.target.value })}
            placeholder="item.status === 'active' && item.score > 50"
            rows={3}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use &apos;item&apos; to reference each element. Return true to include.
          </p>
        </div>
      )}

      {data.operation === "map" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Transform Expression</Label>
          <Textarea
            value={data.expression || ""}
            onChange={(e) => updateData({ expression: e.target.value })}
            placeholder="({ name: item.name, value: item.score * 2 })"
            rows={3}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Define the new shape for each item.
          </p>
        </div>
      )}

      {data.operation === "sort" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sort Field</Label>
            <Input
              value={data.sortField || ""}
              onChange={(e) => updateData({ sortField: e.target.value })}
              placeholder="e.g., createdAt"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Order</Label>
            <Select
              value={data.sortOrder || "asc"}
              onValueChange={(value: string) =>
                updateData({ sortOrder: value as "asc" | "desc" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending (A-Z, 0-9)</SelectItem>
                <SelectItem value="desc">Descending (Z-A, 9-0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {data.operation === "slice" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Start Index</Label>
            <Input
              type="number"
              value={data.sliceStart ?? ""}
              onChange={(e) =>
                updateData({ sliceStart: parseInt(e.target.value) || 0 })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">End Index</Label>
            <Input
              type="number"
              value={data.sliceEnd ?? ""}
              onChange={(e) =>
                updateData({
                  sliceEnd: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="End of list"
            />
          </div>
        </div>
      )}

      {data.operation === "reduce" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reducer Expression</Label>
            <Textarea
              value={data.expression || ""}
              onChange={(e) => updateData({ expression: e.target.value })}
              placeholder="acc + item.value"
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use &apos;acc&apos; for accumulator, &apos;item&apos; for current element.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Initial Value</Label>
            <Input
              value={data.reduceInitial || ""}
              onChange={(e) => updateData({ reduceInitial: e.target.value })}
              placeholder="0"
              className="font-mono"
            />
          </div>
        </div>
      )}

      {data.operation === "group" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Group By Field</Label>
          <Input
            value={data.groupByField || ""}
            onChange={(e) => updateData({ groupByField: e.target.value })}
            placeholder="e.g., category"
          />
        </div>
      )}

      {data.operation === "flatten" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Flatten Depth</Label>
          <Input
            type="number"
            value={data.flattenDepth ?? 1}
            onChange={(e) =>
              updateData({ flattenDepth: parseInt(e.target.value) || 1 })
            }
            min={1}
            max={10}
          />
          <p className="text-xs text-muted-foreground">
            How many levels of nesting to flatten (1 = one level)
          </p>
        </div>
      )}

      {/* Output Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Output Variable</Label>
        <Input
          value={data.outputVariable || ""}
          onChange={(e) => updateData({ outputVariable: e.target.value })}
          placeholder="processed_list"
        />
      </div>

      {/* Operation Preview */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-sm font-medium">Operation Preview</Label>
          <div className="mt-2 rounded-lg bg-muted p-3 font-mono text-sm">
            <span className="text-muted-foreground">
              {data.outputVariable || "result"} = {data.inputVariable || "list"}.
              {data.operation}(...)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <span className="text-sm font-medium">Examples & Help</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Card>
            <CardContent className="space-y-3 pt-4 text-sm">
              <div>
                <Badge variant="secondary">Filter</Badge>
                <code className="ml-2 text-xs">item.age {"> 18"}</code>
              </div>
              <div>
                <Badge variant="secondary">Map</Badge>
                <code className="ml-2 text-xs">{"({ ...item, fullName: item.first + ' ' + item.last })"}</code>
              </div>
              <div>
                <Badge variant="secondary">Reduce</Badge>
                <code className="ml-2 text-xs">acc + item.price</code>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
