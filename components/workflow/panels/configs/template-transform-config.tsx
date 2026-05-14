"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Copy, Code2, Eye } from "lucide-react"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface TemplateTransformData {
  template?: string
  engine?: "jinja2" | "handlebars" | "mustache" | "simple"
  outputType?: "string" | "json" | "array"
  escapeHtml?: boolean
  trimWhitespace?: boolean
}

const TEMPLATE_ENGINES = [
  { 
    value: "jinja2", 
    label: "Jinja2", 
    description: "Python-style templating with filters and macros",
    example: "{{ name | upper }} - {% for item in items %}{{ item }}{% endfor %}"
  },
  { 
    value: "handlebars", 
    label: "Handlebars", 
    description: "Logic-less templates with helpers",
    example: "{{name}} - {{#each items}}{{this}}{{/each}}"
  },
  { 
    value: "mustache", 
    label: "Mustache", 
    description: "Minimal logic-less templates",
    example: "{{name}} - {{#items}}{{.}}{{/items}}"
  },
  { 
    value: "simple", 
    label: "Simple Substitution", 
    description: "Basic {{variable}} replacement",
    example: "Hello {{name}}, you have {{count}} items."
  },
]

const JINJA_FILTERS = [
  { name: "upper", description: "Convert to uppercase", example: "{{ name | upper }}" },
  { name: "lower", description: "Convert to lowercase", example: "{{ name | lower }}" },
  { name: "title", description: "Title case", example: "{{ name | title }}" },
  { name: "trim", description: "Remove whitespace", example: "{{ text | trim }}" },
  { name: "length", description: "Get length", example: "{{ items | length }}" },
  { name: "default", description: "Default value", example: "{{ name | default('N/A') }}" },
  { name: "join", description: "Join array", example: "{{ items | join(', ') }}" },
  { name: "first", description: "First item", example: "{{ items | first }}" },
  { name: "last", description: "Last item", example: "{{ items | last }}" },
  { name: "replace", description: "Replace text", example: "{{ text | replace('old', 'new') }}" },
]

export function TemplateTransformConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || {}) as TemplateTransformData
  const [previewResult, setPreviewResult] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "helpers">("editor")

  const updateData = (updates: Partial<TemplateTransformData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const selectedEngine = TEMPLATE_ENGINES.find((e) => e.value === (data.engine || "jinja2"))

  const insertVariable = (variableName: string) => {
    const template = data.template || ""
    const insertion = data.engine === "handlebars" || data.engine === "mustache"
      ? `{{${variableName}}}`
      : `{{ ${variableName} }}`
    updateData({ template: template + insertion })
  }

  const handlePreview = () => {
    // Simple preview simulation with mock data
    const template = data.template || ""
    const mockResult = template
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => `[${name}]`)
      .replace(/\{\{\s*(\w+)\s*\|\s*\w+\s*\}\}/g, (_, name) => `[${name}_filtered]`)
    setPreviewResult(mockResult)
    setActiveTab("preview")
  }

  return (
    <div className="space-y-6">
      {/* Template Engine */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Template Engine</Label>
        <Select
          value={data.engine || "jinja2"}
          onValueChange={(value: string) =>
            updateData({ engine: value as TemplateTransformData["engine"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_ENGINES.map((engine) => (
              <SelectItem key={engine.value} value={engine.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{engine.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {engine.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedEngine && (
          <p className="rounded-lg bg-muted p-2 font-mono text-xs">
            Example: {selectedEngine.example}
          </p>
        )}
      </div>

      {/* Template Editor with Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="editor" className="gap-1">
              <Code2 className="h-3 w-3" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
            {(data.engine === "jinja2") && (
              <TabsTrigger value="helpers">Filters</TabsTrigger>
            )}
          </TabsList>
          <div className="flex gap-2">
            <VariableSelector
              variables={availableVariables}
              onSelect={(variable) => insertVariable(variable.name)}
            />
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Play className="mr-1 h-3 w-3" />
              Preview
            </Button>
          </div>
        </div>

        <TabsContent value="editor" className="mt-3">
          <Textarea
            value={data.template || ""}
            onChange={(e) => updateData({ template: e.target.value })}
            placeholder={`Enter your template...\n\nExample:\n${selectedEngine?.example || ""}`}
            rows={12}
            className="font-mono text-sm"
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                Preview Output
                <Button variant="ghost" size="sm">
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="min-h-[200px] whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm">
                {previewResult || "Click 'Preview' to see the output..."}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="helpers" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Available Jinja2 Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {JINJA_FILTERS.map((filter) => (
                <div
                  key={filter.name}
                  className="flex items-start justify-between rounded-lg border p-2"
                >
                  <div>
                    <Badge variant="secondary" className="font-mono">
                      {filter.name}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {filter.description}
                    </p>
                  </div>
                  <code className="rounded bg-muted px-2 py-1 text-xs">
                    {filter.example}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Output Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Output Type</Label>
          <Select
            value={data.outputType || "string"}
            onValueChange={(value: string) =>
              updateData({ outputType: value as TemplateTransformData["outputType"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="json">JSON Object</SelectItem>
              <SelectItem value="array">Array</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Available Variables */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Available Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No variables available from upstream nodes
              </p>
            ) : (
              availableVariables.map((variable) => (
                <Badge
                  key={variable.name}
                  variant="outline"
                  className="cursor-pointer font-mono"
                  onClick={() => insertVariable(variable.name)}
                >
                  {variable.name}
                  <span className="ml-1 text-muted-foreground">
                    ({variable.type})
                  </span>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
