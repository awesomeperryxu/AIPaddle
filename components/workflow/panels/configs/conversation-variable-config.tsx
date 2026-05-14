"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { NodeConfigProps } from "../../types"
import { VarType } from "../../types"

interface ConversationVariable {
  id: string
  name: string
  type: VarType
  defaultValue?: string
  persistent: boolean
  description?: string
}

interface ConversationVariableData {
  variables: ConversationVariable[]
  resetOnNewConversation?: boolean
  maxHistorySize?: number
}

const VARIABLE_TYPES: { value: VarType; label: string; defaultVal: string }[] = [
  { value: VarType.String, label: "String", defaultVal: "" },
  { value: VarType.Number, label: "Number", defaultVal: "0" },
  { value: VarType.Boolean, label: "Boolean", defaultVal: "false" },
  { value: VarType.Array, label: "Array", defaultVal: "[]" },
  { value: VarType.Object, label: "Object", defaultVal: "{}" },
]

export function ConversationVariableConfig({
  node,
  onUpdate,
}: NodeConfigProps) {
  const data = (node.data as unknown as ConversationVariableData) || { variables: [] }
  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set())

  const updateData = (updates: Partial<ConversationVariableData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates } as unknown as import('../../types').NodeConfig,
    })
  }

  const variables = data.variables || []

  const addVariable = () => {
    const newVar: ConversationVariable = {
      id: `conv_var_${Date.now()}`,
      name: "",
      type: VarType.String,
      defaultValue: "",
      persistent: true,
    }
    updateData({ variables: [...variables, newVar] })
    setExpandedVars(new Set([...expandedVars, newVar.id]))
  }

  const updateVariable = (id: string, updates: Partial<ConversationVariable>) => {
    updateData({
      variables: variables.map((v) =>
        v.id === id ? { ...v, ...updates } : v
      ),
    })
  }

  const removeVariable = (id: string) => {
    updateData({ variables: variables.filter((v) => v.id !== id) })
  }

  const toggleVar = (id: string) => {
    const newExpanded = new Set(expandedVars)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedVars(newExpanded)
  }

  return (
    <div className="space-y-6">
      {/* Chatflow Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <MessageSquare className="h-3 w-3" />
          Chatflow Only
        </Badge>
        <span className="text-xs text-muted-foreground">
          Manage variables that persist across conversation turns
        </span>
      </div>

      {/* Variables List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Conversation Variables</Label>
          <Button variant="outline" size="sm" onClick={addVariable}>
            <Plus className="mr-1 h-3 w-3" />
            Add Variable
          </Button>
        </div>

        {variables.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No conversation variables defined.
              </p>
              <p className="text-xs text-muted-foreground">
                Add variables to track state across conversation turns.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addVariable}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add First Variable
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {variables.map((variable) => (
              <Collapsible
                key={variable.id}
                open={expandedVars.has(variable.id)}
                onOpenChange={() => toggleVar(variable.id)}
              >
                <Card>
                  <div className="flex items-center justify-between p-3">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start gap-2 p-0 hover:bg-transparent"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedVars.has(variable.id) ? "rotate-180" : ""
                          }`}
                        />
                        <span className="font-mono font-medium">
                          {variable.name || "unnamed"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {variable.type}
                        </Badge>
                        {variable.persistent && (
                          <Badge variant="outline" className="text-xs">
                            Persistent
                          </Badge>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeVariable(variable.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 border-t pt-4">
                      {/* Variable Name */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Variable Name</Label>
                          <Input
                            value={variable.name}
                            onChange={(e) =>
                              updateVariable(variable.id, { name: e.target.value })
                            }
                            placeholder="e.g., user_preference"
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={variable.type}
                            onValueChange={(value: string) =>
                              updateVariable(variable.id, { type: value as VarType })
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

                      {/* Default Value */}
                      <div className="space-y-2">
                        <Label className="text-xs">Default Value</Label>
                        {variable.type === VarType.Object || variable.type === VarType.Array ? (
                          <Textarea
                            value={variable.defaultValue || ""}
                            onChange={(e) =>
                              updateVariable(variable.id, {
                                defaultValue: e.target.value,
                              })
                            }
                            placeholder={
                              variable.type === "object" ? '{"key": "value"}' : '["item1", "item2"]'
                            }
                            rows={3}
                            className="font-mono text-sm"
                          />
                        ) : (
                          <Input
                            value={variable.defaultValue || ""}
                            onChange={(e) =>
                              updateVariable(variable.id, {
                                defaultValue: e.target.value,
                              })
                            }
                            placeholder={
                              variable.type === "boolean"
                                ? "true or false"
                                : variable.type === "number"
                                ? "0"
                                : "Default value..."
                            }
                            type={variable.type === "number" ? "number" : "text"}
                          />
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-xs">Description (optional)</Label>
                        <Input
                          value={variable.description || ""}
                          onChange={(e) =>
                            updateVariable(variable.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="What this variable is used for..."
                        />
                      </div>

                      {/* Persistent */}
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <Label className="text-sm">Persistent</Label>
                          <p className="text-xs text-muted-foreground">
                            Maintain value across conversation turns
                          </p>
                        </div>
                        <Switch
                          checked={variable.persistent}
                          onCheckedChange={(persistent) =>
                            updateVariable(variable.id, { persistent })
                          }
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {/* Global Settings */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Global Settings</Label>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm">Reset on New Conversation</Label>
            <p className="text-xs text-muted-foreground">
              Clear all variables when a new conversation starts
            </p>
          </div>
          <Switch
            checked={data.resetOnNewConversation ?? true}
            onCheckedChange={(resetOnNewConversation) =>
              updateData({ resetOnNewConversation })
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Max History Size</Label>
          <Input
            type="number"
            value={data.maxHistorySize || ""}
            onChange={(e) =>
              updateData({
                maxHistorySize: parseInt(e.target.value) || undefined,
              })
            }
            placeholder="Unlimited"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of conversation turns to keep in memory
          </p>
        </div>
      </div>
    </div>
  )
}
