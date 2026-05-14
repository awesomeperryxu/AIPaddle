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
import { Plus, Trash2, ArrowRight, GripVertical } from "lucide-react"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps, VariableType } from "../../types"

interface VariableAssignment {
  id: string
  targetVariable: string
  targetType: VariableType
  sourceExpression: string
  operation: "set" | "append" | "increment" | "decrement" | "toggle"
}

interface VariableAssignerData {
  assignments: VariableAssignment[]
  createIfNotExists?: boolean
  scope?: "local" | "global" | "conversation"
}

const OPERATIONS = [
  { value: "set", label: "Set", description: "Replace the value" },
  { value: "append", label: "Append", description: "Add to array/string" },
  { value: "increment", label: "Increment", description: "Add to number" },
  { value: "decrement", label: "Decrement", description: "Subtract from number" },
  { value: "toggle", label: "Toggle", description: "Flip boolean" },
]

const VARIABLE_TYPES: { value: VariableType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
]

export function VariableAssignerConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || { assignments: [] }) as VariableAssignerData

  const updateData = (updates: Partial<VariableAssignerData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const assignments = data.assignments || []

  const addAssignment = () => {
    const newAssignment: VariableAssignment = {
      id: `assign_${Date.now()}`,
      targetVariable: "",
      targetType: "string",
      sourceExpression: "",
      operation: "set",
    }
    updateData({ assignments: [...assignments, newAssignment] })
  }

  const updateAssignment = (id: string, updates: Partial<VariableAssignment>) => {
    updateData({
      assignments: assignments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })
  }

  const removeAssignment = (id: string) => {
    updateData({ assignments: assignments.filter((a) => a.id !== id) })
  }

  return (
    <div className="space-y-6">
      {/* Scope Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Variable Scope</Label>
        <Select
          value={data.scope || "local"}
          onValueChange={(scope: VariableAssignerData["scope"]) =>
            updateData({ scope })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">
              <div className="flex flex-col">
                <span>Local</span>
                <span className="text-xs text-muted-foreground">
                  Available within this workflow run
                </span>
              </div>
            </SelectItem>
            <SelectItem value="global">
              <div className="flex flex-col">
                <span>Global</span>
                <span className="text-xs text-muted-foreground">
                  Persistent across workflow runs
                </span>
              </div>
            </SelectItem>
            <SelectItem value="conversation">
              <div className="flex flex-col">
                <span>Conversation (Chatflow only)</span>
                <span className="text-xs text-muted-foreground">
                  Persists within conversation session
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Variable Assignments</Label>
          <Button variant="outline" size="sm" onClick={addAssignment}>
            <Plus className="mr-1 h-3 w-3" />
            Add Assignment
          </Button>
        </div>

        {assignments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                No assignments defined. Add assignments to set variable values.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addAssignment}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add First Assignment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment, index) => (
              <Card key={assignment.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="flex-1 text-sm font-medium">
                      {assignment.targetVariable || "New Assignment"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeAssignment(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Target Variable */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Target Variable</Label>
                      <Input
                        value={assignment.targetVariable}
                        onChange={(e) =>
                          updateAssignment(assignment.id, {
                            targetVariable: e.target.value,
                          })
                        }
                        placeholder="Variable name..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={assignment.targetType}
                        onValueChange={(targetType: VariableType) =>
                          updateAssignment(assignment.id, { targetType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VARIABLE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Operation */}
                  <div className="space-y-2">
                    <Label className="text-xs">Operation</Label>
                    <Select
                      value={assignment.operation}
                      onValueChange={(operation: VariableAssignment["operation"]) =>
                        updateAssignment(assignment.id, { operation })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATIONS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            <div className="flex flex-col">
                              <span>{op.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {op.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Source Expression */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Source Value / Expression</Label>
                      <VariableSelector
                        variables={availableVariables}
                        onSelect={(variable) =>
                          updateAssignment(assignment.id, {
                            sourceExpression:
                              assignment.sourceExpression + `{{${variable.name}}}`,
                          })
                        }
                      />
                    </div>
                    <Input
                      value={assignment.sourceExpression}
                      onChange={(e) =>
                        updateAssignment(assignment.id, {
                          sourceExpression: e.target.value,
                        })
                      }
                      placeholder="Value or expression..."
                      className="font-mono"
                    />
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-2 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {assignment.targetVariable || "variable"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">
                      {assignment.operation}(
                      {assignment.sourceExpression || "value"})
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="text-sm font-medium">Create if Not Exists</Label>
          <p className="text-xs text-muted-foreground">
            Automatically create new variables if they don&apos;t exist
          </p>
        </div>
        <input
          type="checkbox"
          checked={data.createIfNotExists ?? true}
          onChange={(e) => updateData({ createIfNotExists: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {/* Available Variables Reference */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-sm font-medium">Available Variables</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No variables from upstream nodes
              </p>
            ) : (
              availableVariables.map((v) => (
                <Badge key={v.name} variant="outline" className="font-mono">
                  {v.name}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
