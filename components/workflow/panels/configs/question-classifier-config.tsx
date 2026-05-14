"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ModelSelector } from "../common/model-selector"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface ClassificationCategory {
  id: string
  name: string
  description: string
  keywords?: string[]
  examples?: string[]
}

interface QuestionClassifierData {
  model?: string
  inputVariable?: string
  categories: ClassificationCategory[]
  classificationPrompt?: string
  multiLabel?: boolean
  confidenceThreshold?: number
}

export function QuestionClassifierConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || { categories: [] }) as QuestionClassifierData
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const updateData = (updates: Partial<QuestionClassifierData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const categories = data.categories || []

  const addCategory = () => {
    const newCategory: ClassificationCategory = {
      id: `cat_${Date.now()}`,
      name: `Category ${categories.length + 1}`,
      description: "",
      keywords: [],
      examples: [],
    }
    updateData({ categories: [...categories, newCategory] })
    setExpandedCategories(new Set([...expandedCategories, newCategory.id]))
  }

  const updateCategory = (id: string, updates: Partial<ClassificationCategory>) => {
    updateData({
      categories: categories.map((cat) =>
        cat.id === id ? { ...cat, ...updates } : cat
      ),
    })
  }

  const removeCategory = (id: string) => {
    updateData({ categories: categories.filter((cat) => cat.id !== id) })
  }

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Classification Model</Label>
        <ModelSelector
          value={data.model || ""}
          onChange={(model) => updateData({ model })}
          placeholder="Select model for classification..."
        />
      </div>

      {/* Input Variable */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Input to Classify</Label>
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

      {/* Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Classification Categories</Label>
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="mr-1 h-3 w-3" />
            Add Category
          </Button>
        </div>

        {categories.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                No categories defined. Add categories to classify questions.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={addCategory}>
                <Plus className="mr-1 h-3 w-3" />
                Add First Category
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {categories.map((category, index) => (
              <Collapsible
                key={category.id}
                open={expandedCategories.has(category.id)}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <Card>
                  <CardHeader className="p-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-between p-0 hover:bg-transparent"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-6 w-6 rounded-full p-0 text-center"
                            >
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedCategories.has(category.id) ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeCategory(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {/* Category Name */}
                      <div className="space-y-2">
                        <Label className="text-xs">Category Name</Label>
                        <Input
                          value={category.name}
                          onChange={(e) =>
                            updateCategory(category.id, { name: e.target.value })
                          }
                          placeholder="e.g., Technical Support"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={category.description}
                          onChange={(e) =>
                            updateCategory(category.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Describe what questions belong to this category..."
                          rows={2}
                        />
                      </div>

                      {/* Keywords */}
                      <div className="space-y-2">
                        <Label className="text-xs">Keywords (comma-separated)</Label>
                        <Input
                          value={category.keywords?.join(", ") || ""}
                          onChange={(e) =>
                            updateCategory(category.id, {
                              keywords: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="help, support, issue, problem"
                        />
                      </div>

                      {/* Examples */}
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Example Questions (one per line)
                        </Label>
                        <Textarea
                          value={category.examples?.join("\n") || ""}
                          onChange={(e) =>
                            updateCategory(category.id, {
                              examples: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="How do I reset my password?&#10;Why is my account locked?"
                          rows={3}
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

      {/* Advanced Options */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <span className="font-medium">Advanced Options</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Custom Classification Prompt */}
          <div className="space-y-2">
            <Label className="text-sm">Custom Classification Prompt</Label>
            <Textarea
              value={data.classificationPrompt || ""}
              onChange={(e) =>
                updateData({ classificationPrompt: e.target.value })
              }
              placeholder="Override the default classification prompt..."
              rows={3}
            />
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-2">
            <Label className="text-sm">
              Confidence Threshold: {((data.confidenceThreshold || 0.5) * 100).toFixed(0)}%
            </Label>
            <input
              type="range"
              min="0"
              max="100"
              value={(data.confidenceThreshold || 0.5) * 100}
              onChange={(e) =>
                updateData({
                  confidenceThreshold: parseInt(e.target.value) / 100,
                })
              }
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum confidence required to assign a category
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
