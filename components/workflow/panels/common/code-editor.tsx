'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Wand2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CodeLanguage } from '../../types';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  onLanguageChange?: (language: CodeLanguage) => void;
  placeholder?: string;
  disabled?: boolean;
  showLanguageSelector?: boolean;
  showAIGenerate?: boolean;
  onAIGenerate?: () => void;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

// Simple syntax highlighting colors
const languageColors: Record<CodeLanguage, { bg: string; text: string; badge: string }> = {
  [CodeLanguage.Python3]: {
    bg: 'bg-blue-500/5',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  [CodeLanguage.JavaScript]: {
    bg: 'bg-yellow-500/5',
    text: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  },
};

// Default code templates
const defaultTemplates: Record<CodeLanguage, string> = {
  [CodeLanguage.Python3]: `def main(arg1: str) -> dict:
    """
    Main function to process input
    
    Args:
        arg1: Input string parameter
        
    Returns:
        Dictionary with result
    """
    return {
        "result": arg1
    }`,
  [CodeLanguage.JavaScript]: `function main(arg1) {
    /**
     * Main function to process input
     * @param {string} arg1 - Input string parameter
     * @returns {object} - Result object
     */
    return {
        result: arg1
    };
}`,
};

export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  placeholder,
  disabled = false,
  showLanguageSelector = true,
  showAIGenerate = true,
  onAIGenerate,
  minHeight = 200,
  maxHeight = 500,
  className,
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const colors = languageColors[language];

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [value]);

  const handleReset = useCallback(() => {
    onChange(defaultTemplates[language]);
  }, [language, onChange]);

  const handleLanguageChange = useCallback((newLanguage: CodeLanguage) => {
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
      // If the code is empty or is the default template, update to new language template
      if (!value || value === defaultTemplates[language]) {
        onChange(defaultTemplates[newLanguage]);
      }
    }
  }, [language, onLanguageChange, onChange, value]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showLanguageSelector && onLanguageChange ? (
            <Select
              value={language}
              onValueChange={handleLanguageChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CodeLanguage.Python3}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Python 3
                  </div>
                </SelectItem>
                <SelectItem value={CodeLanguage.JavaScript}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    JavaScript
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={colors.badge}>
              {language === CodeLanguage.Python3 ? 'Python 3' : 'JavaScript'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showAIGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onAIGenerate}
                    disabled={disabled}
                    className="h-8 w-8"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>AI 生成代码</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  disabled={disabled || !value}
                  className="h-8 w-8"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? '已复制' : '复制代码'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpanded(!expanded)}
                  disabled={disabled}
                  className="h-8 w-8"
                >
                  {expanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{expanded ? '收起' : '展开'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Code Editor */}
      <div className={cn('relative rounded-lg border overflow-hidden', colors.bg)}>
        {/* Line Numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-10 border-r bg-muted/50 flex flex-col text-right pr-2 pt-3 text-xs text-muted-foreground font-mono select-none">
          {value.split('\n').map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Input */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || defaultTemplates[language]}
          disabled={disabled}
          className={cn(
            'pl-12 font-mono text-sm leading-6 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
            colors.text
          )}
          style={{
            minHeight: expanded ? maxHeight : minHeight,
            maxHeight: expanded ? 'none' : maxHeight,
          }}
          spellCheck={false}
        />
      </div>

      {/* Help Text */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {language === CodeLanguage.Python3
            ? '函数名必须是 main，返回值必须是 dict'
            : '函数名必须是 main，返回值必须是对象'}
        </span>
        <Button
          variant="link"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
          className="h-auto p-0 text-xs"
        >
          重置为模板
        </Button>
      </div>
    </div>
  );
}
