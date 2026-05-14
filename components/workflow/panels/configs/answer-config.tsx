"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Eye, ChevronDown, Sparkles } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface AnswerNodeData {
  answerTemplate?: string
  responseFormat?: "text" | "markdown" | "html"
  streamingEnabled?: boolean
  typingIndicator?: boolean
  typingDelay?: number
  citations?: boolean
  suggestedFollowUps?: string[]
  showSourceDocuments?: boolean
  feedbackEnabled?: boolean
}

const FOLLOW_UP_EXAMPLES = [
  "Can you explain more about this topic?",
  "What are the next steps?",
  "Are there any alternatives?",
  "Can you provide an example?",
]

export function AnswerConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || {}) as AnswerNodeData
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "settings">(
    "editor"
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<AnswerNodeData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const suggestedFollowUps = data.suggestedFollowUps || []

  const addFollowUp = () => {
    updateData({
      suggestedFollowUps: [...suggestedFollowUps, ""],
    })
  }

  const updateFollowUp = (index: number, value: string) => {
    const newFollowUps = [...suggestedFollowUps]
    newFollowUps[index] = value
    updateData({ suggestedFollowUps: newFollowUps })
  }

  const removeFollowUp = (index: number) => {
    updateData({
      suggestedFollowUps: suggestedFollowUps.filter((_, i) => i !== index),
    })
  }

  const insertVariable = (variableName: string) => {
    const template = data.answerTemplate || ""
    updateData({ answerTemplate: template + `{{${variableName}}}` })
  }

  // Generate preview with mock data
  const generatePreview = () => {
    const template = data.answerTemplate || ""
    return template
      .replace(/\{\{(\w+)\}\}/g, (_, name) => `[${name}]`)
      .replace(/\n/g, "<br/>")
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
          This node sends responses to the conversation
        </span>
      </div>

      {/* Answer Editor with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <VariableSelector
            variables={availableVariables}
            onSelect={(v) => insertVariable(v.name)}
          />
        </div>

        <TabsContent value="editor" className="mt-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Answer Template</Label>
            <Textarea
              value={data.answerTemplate || ""}
              onChange={(e) => updateData({ answerTemplate: e.target.value })}
              placeholder="Enter the response template...\n\nUse {{variable}} to insert dynamic content.\nSupports Markdown formatting."
              rows={10}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {availableVariables.slice(0, 5).map((v) => (
                <Badge
                  key={v.name}
                  variant="outline"
                  className="cursor-pointer font-mono"
                  onClick={() => insertVariable(v.name)}
                >
                  {v.name}
                </Badge>
              ))}
              {availableVariables.length > 5 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{availableVariables.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                Response Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="min-h-[200px] rounded-lg bg-muted p-4"
                dangerouslySetInnerHTML={{ __html: generatePreview() || "<span class='text-muted-foreground'>No content yet...</span>" }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-3 space-y-4">
          {/* Response Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Response Format</Label>
            <Select
              value={data.responseFormat || "markdown"}
              onValueChange={(responseFormat: AnswerNodeData["responseFormat"]) =>
                updateData({ responseFormat })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Plain Text</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Streaming */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Streaming Response</Label>
              <p className="text-xs text-muted-foreground">
                Stream the response character by character
              </p>
            </div>
            <Switch
              checked={data.streamingEnabled ?? true}
              onCheckedChange={(streamingEnabled) =>
                updateData({ streamingEnabled })
              }
            />
          </div>

          {/* Typing Indicator */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Typing Indicator</Label>
              <p className="text-xs text-muted-foreground">
                Show &quot;typing...&quot; before response appears
              </p>
            </div>
            <Switch
              checked={data.typingIndicator ?? false}
              onCheckedChange={(typingIndicator) =>
                updateData({ typingIndicator })
              }
            />
          </div>

          {/* Citations */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Show Citations</Label>
              <p className="text-xs text-muted-foreground">
                Include source citations in the response
              </p>
            </div>
            <Switch
              checked={data.citations ?? false}
              onCheckedChange={(citations) => updateData({ citations })}
            />
          </div>

          {/* Feedback */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Feedback Buttons</Label>
              <p className="text-xs text-muted-foreground">
                Show thumbs up/down feedback buttons
              </p>
            </div>
            <Switch
              checked={data.feedbackEnabled ?? true}
              onCheckedChange={(feedbackEnabled) =>
                updateData({ feedbackEnabled })
              }
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Suggested Follow-ups */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <span className="font-medium">Suggested Follow-up Questions</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {suggestedFollowUps.map((followUp, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={followUp}
                onChange={(e) => updateFollowUp(index, e.target.value)}
                placeholder="Enter a follow-up question..."
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFollowUp(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addFollowUp}>
              Add Follow-up
            </Button>
            {suggestedFollowUps.length === 0 && (
              <div className="flex gap-1">
                {FOLLOW_UP_EXAMPLES.slice(0, 2).map((example, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() =>
                      updateData({
                        suggestedFollowUps: [...suggestedFollowUps, example],
                      })
                    }
                  >
                    + {example.slice(0, 20)}...
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
