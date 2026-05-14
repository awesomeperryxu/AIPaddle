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
import { Plus, Trash2, ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ModelSelector } from "../common/model-selector"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface ExtractedParameter {
  id: string
  name: string
  type: "string" | "number" | "boolean" | "array" | "object"
  description: string
  required: boolean
  defaultValue?: string
  validationPattern?: string
  enumValues?: string[]
}

interface ParameterExtractorData {
  model?: string
  inputVariable?: string
  extractionPrompt?: string
  parameters: ExtractedParameter[]
  strictMode?: boolean
  outputFormat?: "json" | "yaml" | "structured"
}

const PARAM_TYPES = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
]

export function ParameterExtractorConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || { parameters: [] }) as ParameterExtractorData
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set())

  const updateData = (updates: Partial<ParameterExtractorData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const parameters = data.parameters || []

  const addParameter = () => {
    const newParam: ExtractedParameter = {
      id: `param_${Date.now()}`,
      name: "",
      type: "string",
      description: "",
      required: true,
    }
    updateData({ parameters: [...parameters, newParam] })
    setExpandedParams(new Set([...expandedParams, newParam.id]))
  }

  const updateParameter = (id: string, updates: Partial<ExtractedParameter>) => {
    updateData({
      parameters: parameters.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })
  }

  const removeParameter = (id: string) => {
    updateData({ parameters: parameters.filter((p) => p.id !== id) })
  }

  const toggleParam = (id: string) => {
    const newExpanded = new Set(expandedParams)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedParams(newExpanded)
  }

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Extraction Model</Label>
        <ModelSelector
          value={data.model || ""}
          onChange={(model) => updateData({ model })}
          placeholder="Select model for extraction..."
        />
      </div>

      {/* Input Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Input Text</Label>
        <div className="flex gap-2">
          <Input
            value={data.inputVariable || ""}
            onChange={(e) => updateData({ inputVariable: e.target.value })}
            placeholder="Select or enter variable..."
            className="flex-1"
          />
          <VariableSelector
            variables={availableVariables}
            onSelect={(variable) =>
              updateData({ inputVariable: `{{${variable.name}}}` })
            }
          />
        </div>
      </div>

      {/* Extraction Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Extraction Instructions</Label>
        <Textarea
          value={data.extractionPrompt || ""}
          onChange={(e) => updateData({ extractionPrompt: e.target.value })}
          placeholder="Additional instructions for parameter extraction..."
          rows={3}
        />
      </div>

      {/* Parameters to Extract */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Parameters to Extract</Label>
          <Button variant="outline" size="sm" onClick={addParameter}>
            <Plus className="mr-1 h-3 w-3" />
            Add Parameter
          </Button>
        </div>

        {parameters.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Define parameters to extract from the input text.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addParameter}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add First Parameter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {parameters.map((param) => (
              <Collapsible
                key={param.id}
                open={expandedParams.has(param.id)}
                onOpenChange={() => toggleParam(param.id)}
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
                            expandedParams.has(param.id) ? "rotate-180" : ""
                          }`}
                        />
                        <span className="font-medium">
                          {param.name || "Unnamed Parameter"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {param.type}
                        </Badge>
                        {param.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeParameter(param.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 border-t pt-4">
                      {/* Parameter Name */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Parameter Name</Label>
                          <Input
                            value={param.name}
                            onChange={(e) =>
                              updateParameter(param.id, { name: e.target.value })
                            }
                            placeholder="e.g., customerEmail"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={param.type}
                            onValueChange={(type: ExtractedParameter["type"]) =>
                              updateParameter(param.id, { type })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PARAM_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={param.description}
                          onChange={(e) =>
                            updateParameter(param.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Describe what this parameter represents..."
                          rows={2}
                        />
                      </div>

                      {/* Required & Default */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <Label className="text-xs">Required</Label>
                          <Switch
                            checked={param.required}
                            onCheckedChange={(required) =>
                              updateParameter(param.id, { required })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Default Value</Label>
                          <Input
                            value={param.defaultValue || ""}
                            onChange={(e) =>
                              updateParameter(param.id, {
                                defaultValue: e.target.value,
                              })
                            }
                            placeholder="Default if not found"
                          />
                        </div>
                      </div>

                      {/* Validation Pattern (for strings) */}
                      {param.type === "string" && (
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Validation Pattern (Regex)
                          </Label>
                          <Input
                            value={param.validationPattern || ""}
                            onChange={(e) =>
                              updateParameter(param.id, {
                                validationPattern: e.target.value,
                              })
                            }
                            placeholder="e.g., ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$"
                            className="font-mono text-xs"
                          />
                        </div>
                      )}

                      {/* Enum Values */}
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Allowed Values (comma-separated, leave empty for any)
                        </Label>
                        <Input
                          value={param.enumValues?.join(", ") || ""}
                          onChange={(e) =>
                            updateParameter(param.id, {
                              enumValues: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="e.g., low, medium, high"
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

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Strict Mode</Label>
            <p className="text-xs text-muted-foreground">
              Fail if any required parameter cannot be extracted
            </p>
          </div>
          <Switch
            checked={data.strictMode ?? true}
            onCheckedChange={(strictMode) => updateData({ strictMode })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Output Format</Label>
          <Select
            value={data.outputFormat || "json"}
            onValueChange={(outputFormat: ParameterExtractorData["outputFormat"]) =>
              updateData({ outputFormat })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="yaml">YAML</SelectItem>
              <SelectItem value="structured">Structured Object</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
