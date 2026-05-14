"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, FileText, Image, Table2 } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { VariableSelector } from "../common/variable-selector"
import type { NodeConfigProps } from "../../types"

interface DocumentExtractorData {
  inputVariable?: string
  extractionType?: "text" | "tables" | "images" | "all"
  ocrEnabled?: boolean
  ocrLanguages?: string[]
  preserveFormatting?: boolean
  chunkSize?: number
  chunkOverlap?: number
  outputFormat?: "plain" | "markdown" | "html"
  supportedFormats?: string[]
}

const OCR_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
]

const DOCUMENT_FORMATS = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "docx", label: "Word (DOCX)", icon: FileText },
  { value: "xlsx", label: "Excel (XLSX)", icon: Table2 },
  { value: "pptx", label: "PowerPoint (PPTX)", icon: FileText },
  { value: "txt", label: "Plain Text", icon: FileText },
  { value: "md", label: "Markdown", icon: FileText },
  { value: "html", label: "HTML", icon: FileText },
  { value: "jpg", label: "JPEG Image", icon: Image },
  { value: "png", label: "PNG Image", icon: Image },
]

export function DocumentExtractorConfig({
  node,
  onUpdate,
  availableVariables,
}: NodeConfigProps) {
  const data = (node.data || {}) as DocumentExtractorData
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const updateData = (updates: Partial<DocumentExtractorData>) => {
    onUpdate({
      ...node,
      data: { ...data, ...updates },
    })
  }

  const supportedFormats = data.supportedFormats || ["pdf", "docx", "txt"]
  const ocrLanguages = data.ocrLanguages || ["en"]

  const toggleFormat = (format: string) => {
    if (supportedFormats.includes(format)) {
      updateData({
        supportedFormats: supportedFormats.filter((f) => f !== format),
      })
    } else {
      updateData({
        supportedFormats: [...supportedFormats, format],
      })
    }
  }

  const toggleOcrLanguage = (lang: string) => {
    if (ocrLanguages.includes(lang)) {
      updateData({
        ocrLanguages: ocrLanguages.filter((l) => l !== lang),
      })
    } else {
      updateData({
        ocrLanguages: [...ocrLanguages, lang],
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Input File */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Document Input</Label>
        <div className="flex gap-2">
          <Input
            value={data.inputVariable || ""}
            onChange={(e) => updateData({ inputVariable: e.target.value })}
            placeholder="File URL or variable..."
            className="flex-1"
          />
          <VariableSelector
            variables={availableVariables}
            onSelect={(variable) =>
              updateData({ inputVariable: `{{${variable.name}}}` })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Accepts file URL, base64 data, or file variable
        </p>
      </div>

      {/* Extraction Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Extraction Type</Label>
        <Select
          value={data.extractionType || "all"}
          onValueChange={(value: string) =>
            updateData({ extractionType: value as DocumentExtractorData["extractionType"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Content</SelectItem>
            <SelectItem value="text">Text Only</SelectItem>
            <SelectItem value="tables">Tables Only</SelectItem>
            <SelectItem value="images">Images Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supported Formats */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Supported Formats</Label>
        <div className="grid grid-cols-3 gap-2">
          {DOCUMENT_FORMATS.map((format) => (
            <div
              key={format.value}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <Checkbox
                checked={supportedFormats.includes(format.value)}
                onCheckedChange={() => toggleFormat(format.value)}
              />
              <format.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">{format.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OCR Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">OCR (Optical Character Recognition)</Label>
            <p className="text-xs text-muted-foreground">
              Extract text from images and scanned documents
            </p>
          </div>
          <Switch
            checked={data.ocrEnabled ?? false}
            onCheckedChange={(ocrEnabled) => updateData({ ocrEnabled })}
          />
        </div>

        {data.ocrEnabled && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs text-muted-foreground">OCR Languages</Label>
            <div className="flex flex-wrap gap-2">
              {OCR_LANGUAGES.map((lang) => (
                <Badge
                  key={lang.value}
                  variant={ocrLanguages.includes(lang.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleOcrLanguage(lang.value)}
                >
                  {lang.label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Output Format */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Output Format</Label>
        <Select
          value={data.outputFormat || "plain"}
          onValueChange={(value: string) =>
            updateData({ outputFormat: value as DocumentExtractorData["outputFormat"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain Text</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <span className="font-medium">Advanced Settings</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3">
          {/* Preserve Formatting */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Preserve Formatting</Label>
              <p className="text-xs text-muted-foreground">
                Maintain original document structure
              </p>
            </div>
            <Switch
              checked={data.preserveFormatting ?? true}
              onCheckedChange={(preserveFormatting) =>
                updateData({ preserveFormatting })
              }
            />
          </div>

          {/* Chunking */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Chunk Size</Label>
              <Input
                type="number"
                value={data.chunkSize || ""}
                onChange={(e) =>
                  updateData({ chunkSize: parseInt(e.target.value) || undefined })
                }
                placeholder="Characters (default: none)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Chunk Overlap</Label>
              <Input
                type="number"
                value={data.chunkOverlap || ""}
                onChange={(e) =>
                  updateData({
                    chunkOverlap: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder="Characters (default: 0)"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
