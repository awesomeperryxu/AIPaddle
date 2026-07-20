'use client';

import { useState } from 'react';
import { Code2, Plus, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigPanelWrapper } from '../../config-panel-wrapper';
import type { WorkflowNode, CodeNodeConfig, ValueSelector } from '../../../types';
import { CodeLanguage } from '../../../types';

// Accent color for Code node
const ACCENT_COLOR = '#F59E0B';

interface CodeConfigPanelV2Props {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<CodeNodeConfig>) => void;
  onClose: () => void;
  onSave?: () => void;
  onReset?: () => void;
  isOpen: boolean;
  appType?: 'workflow' | 'chatflow';
}

interface InputVariable {
  id: string;
  name: string;
  reference: string;
}

interface OutputVariable {
  name: string;
  type: string;
}

// Default code templates
const DEFAULT_PYTHON_CODE = `def main(arg1: str) -> dict:
    """
    Process the input and return result
    
    Args:
        arg1: Input string parameter
        
    Returns:
        Dictionary with result
    """
    return {
        "output": arg1
    }`;

const DEFAULT_JS_CODE = `function main(arg1) {
    /**
     * Process the input and return result
     * @param {string} arg1 - Input string parameter
     * @returns {object} - Result object
     */
    return {
        output: arg1
    };
}`;

// Available variable references (mock data)
const AVAILABLE_REFS = [
  { value: 'start.query', label: 'Start / query' },
  { value: 'start.user_id', label: 'Start / user_id' },
  { value: 'llm_1.text', label: 'LLM / text' },
  { value: 'llm_1.usage', label: 'LLM / usage' },
];

export function CodeConfigPanelV2({
  node,
  allNodes,
  onUpdate,
  onClose,
  onSave,
  onReset,
  isOpen,
  appType = 'workflow',
}: CodeConfigPanelV2Props) {
  const config = (node.data || {}) as CodeNodeConfig;
  
  // Local state
  const [language, setLanguage] = useState<'python3' | 'javascript'>(
    config.language === CodeLanguage.JavaScript ? 'javascript' : 'python3'
  );
  const [code, setCode] = useState(
    config.code || (language === 'python3' ? DEFAULT_PYTHON_CODE : DEFAULT_JS_CODE)
  );
  const [inputVars, setInputVars] = useState<InputVariable[]>(
    (config.variables || []).map((v: { key?: string; value?: unknown }, i: number) => ({
      id: `var-${i}`,
      name: v.key || '',
      reference: Array.isArray(v.value) ? v.value.join('.') : '',
    }))
  );

  // Handle language change
  const handleLanguageChange = (lang: 'python3' | 'javascript') => {
    setLanguage(lang);
    // Reset to default code if unchanged
    if (code === DEFAULT_PYTHON_CODE || code === DEFAULT_JS_CODE) {
      setCode(lang === 'python3' ? DEFAULT_PYTHON_CODE : DEFAULT_JS_CODE);
    }
  };

  // Add input variable
  const addInputVar = () => {
    setInputVars([
      ...inputVars,
      { id: `var-${Date.now()}`, name: '', reference: '' },
    ]);
  };

  // Update input variable
  const updateInputVar = (id: string, field: 'name' | 'reference', value: string) => {
    setInputVars(
      inputVars.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      )
    );
  };

  // Delete input variable
  const deleteInputVar = (id: string) => {
    setInputVars(inputVars.filter((v) => v.id !== id));
  };

  // Sync function signature from code
  const syncSignature = () => {
    // Parse function parameters from code
    const pythonMatch = code.match(/def main\(([\s\S]*?)\)/);
    const jsMatch = code.match(/function main\(([\s\S]*?)\)/);
    
    let params: string[] = [];
    if (language === 'python3' && pythonMatch) {
      params = pythonMatch[1]
        .split(',')
        .map((p) => p.split(':')[0].trim())
        .filter(Boolean);
    } else if (language === 'javascript' && jsMatch) {
      params = jsMatch[1]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }

    // Update input vars based on parsed params
    if (params.length > 0) {
      setInputVars(
        params.map((name, i) => ({
          id: `var-${Date.now()}-${i}`,
          name,
          reference: inputVars[i]?.reference || '',
        }))
      );
    }
  };

  // Parameter Config Tab Content
  const ParamsTabContent = (
    <div className="space-y-5">
      {/* Language Selector - Full width segmented control */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">编程语言</Label>
        <div className="grid grid-cols-2 gap-0 border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => handleLanguageChange('python3')}
            className={cn(
              'py-2.5 text-sm font-medium transition-colors',
              language === 'python3'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            Python 3
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('javascript')}
            className={cn(
              'py-2.5 text-sm font-medium transition-colors',
              language === 'javascript'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            )}
          >
            JavaScript
          </button>
        </div>
      </div>

      {/* Input Variables */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">输入变量</Label>
          <Button variant="ghost" size="sm" onClick={addInputVar}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加
          </Button>
        </div>
        <div className="space-y-2">
          {inputVars.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <Input
                value={v.name}
                onChange={(e) => updateInputVar(v.id, 'name', e.target.value)}
                placeholder="变量名"
                className="w-24 h-8 text-sm font-mono"
              />
              <Select
                value={v.reference}
                onValueChange={(val) => updateInputVar(v.id, 'reference', val)}
              >
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="选择引用变量" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_REFS.map((ref) => (
                    <SelectItem key={ref.value} value={ref.value}>
                      {ref.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteInputVar(v.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {inputVars.length === 0 && (
            <div className="text-center py-4 border rounded-lg border-dashed text-muted-foreground text-sm">
              点击“添加”按钮添加输入变量
            </div>
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">代码</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {language === 'python3' ? 'Python 3' : 'JavaScript'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={syncSignature}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              同步函数签名
            </Button>
          </div>
        </div>
        {/* Code Editor Area - Styled like terminal */}
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={cn(
            'min-h-[200px] font-mono text-sm resize-none',
            'bg-gray-900 text-green-400 border-gray-700',
            'focus:border-green-500 focus:ring-green-500/20'
          )}
          placeholder={language === 'python3' ? 'def main(arg1):' : 'function main(arg1) {'}
        />
        <p className="text-xs text-muted-foreground">
          提示：真实实现建议使用 @monaco-editor/react 获得更好的编辑体验
        </p>
      </div>
    </div>
  );

  // Output Variables Tab Content
  const OutputVarsTabContent = (
    <div className="space-y-3">
      <div className="p-3 border rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground">
          输出变量由代码 return 字典自动推断
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 border rounded-lg text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">output</span>
            <Badge variant="outline" className="text-xs">
              string
            </Badge>
          </div>
          <span className="text-xs">由 return 语句推断</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4">
        返回的字典键将自动成为输出变量。例如：
        <br />
        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
          {'return {"result": value, "count": 10}'}
        </code>
        <br />
        将产生 <code className="font-mono">result</code> 和 <code className="font-mono">count</code> 两个输出变量。
      </p>
    </div>
  );

  const tabs = [
    { id: 'params', label: '参数配置', content: ParamsTabContent },
    { id: 'outputs', label: '输出变量', content: OutputVarsTabContent },
  ];

  return (
    <ConfigPanelWrapper
      title="代码执行"
      typeBadge="Code"
      icon={<Code2 className="h-4 w-4" />}
      accentColor={ACCENT_COLOR}
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
      onReset={onReset}
      tabs={tabs}
      defaultTab="params"
    />
  );
}
