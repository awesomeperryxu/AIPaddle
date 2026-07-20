'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { CodeEditor } from '../common/code-editor';
import { VariableSelector } from '../common/variable-selector';
import { CodeLanguage, VarType } from '../../types';
import type { WorkflowNode, CodeNodeConfig, ValueSelector, CodeOutputVariable } from '../../types';

interface CodeNodeConfigPanelProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdate: (data: Partial<CodeNodeConfig>) => void;
  appType?: 'workflow' | 'chatflow';
}

function generateId(): string {
  return `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Available variable types for outputs
const outputTypes: { value: VarType; label: string }[] = [
  { value: VarType.String, label: 'String' },
  { value: VarType.Number, label: 'Number' },
  { value: VarType.Boolean, label: 'Boolean' },
  { value: VarType.Object, label: 'Object' },
  { value: VarType.Array, label: 'Array' },
  { value: VarType.ArrayString, label: 'Array[String]' },
  { value: VarType.ArrayNumber, label: 'Array[Number]' },
  { value: VarType.ArrayObject, label: 'Array[Object]' },
];

const defaultPythonCode = `def main(arg1: str) -> dict:
    """
    Process the input and return result
    
    Args:
        arg1: Input string parameter
        
    Returns:
        Dictionary with result
    """
    return {
        "result": arg1
    }`;

const defaultJSCode = `function main(arg1) {
    /**
     * Process the input and return result
     * @param {string} arg1 - Input string parameter
     * @returns {object} - Result object
     */
    return {
        result: arg1
    };
}`;

interface InputVariableItem {
  id?: string;
  key: string;
  value: ValueSelector;
}

export function CodeNodeConfigPanel({
  node,
  allNodes,
  onUpdate,
  appType = 'workflow',
}: CodeNodeConfigPanelProps) {
  const config = node.data as CodeNodeConfig;
  const language = config.language || CodeLanguage.Python3;
  const code = config.code || (language === CodeLanguage.Python3 ? defaultPythonCode : defaultJSCode);
  const variables = (config.variables || []) as InputVariableItem[];
  const outputs = config.outputs || [];
  
  const [showInputs, setShowInputs] = useState(true);
  const [showOutputs, setShowOutputs] = useState(true);

  const updateLanguage = (newLanguage: CodeLanguage) => {
    const newCode = code === defaultPythonCode || code === defaultJSCode
      ? (newLanguage === CodeLanguage.Python3 ? defaultPythonCode : defaultJSCode)
      : code;
    onUpdate({ language: newLanguage, code: newCode });
  };

  // Input Variables
  const addInputVariable = () => {
    const newVar: InputVariableItem = {
      id: generateId(),
      key: `arg${variables.length + 1}`,
      value: [],
    };
    onUpdate({ variables: [...variables, newVar] });
  };

  const updateInputVariable = (index: number, variable: InputVariableItem) => {
    const newVariables = [...variables];
    newVariables[index] = variable;
    onUpdate({ variables: newVariables });
  };

  const deleteInputVariable = (index: number) => {
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    onUpdate({ variables: newVariables });
  };

  // Output Variables
  const addOutputVariable = () => {
    const newOutput: CodeOutputVariable = {
      key: `output${outputs.length + 1}`,
      type: 'string' as VarType,
    };
    onUpdate({ outputs: [...outputs, newOutput] });
  };

  const updateOutputVariable = (index: number, output: CodeOutputVariable) => {
    const newOutputs = [...outputs];
    newOutputs[index] = output;
    onUpdate({ outputs: newOutputs });
  };

  const deleteOutputVariable = (index: number) => {
    const newOutputs = [...outputs];
    newOutputs.splice(index, 1);
    onUpdate({ outputs: newOutputs });
  };

  return (
    <div className="space-y-6">
      {/* Code Editor */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">代码</Label>
        <CodeEditor
          value={code}
          onChange={(newCode) => onUpdate({ code: newCode })}
          language={language}
          onLanguageChange={updateLanguage}
          showLanguageSelector={true}
          showAIGenerate={true}
          onAIGenerate={() => {
            // TODO: Implement AI code generation
          }}
          minHeight={200}
          maxHeight={400}
        />
      </div>

      <Separator />

      {/* Input Variables */}
      <Collapsible open={showInputs} onOpenChange={setShowInputs}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">输入变量</span>
              <Badge variant="secondary" className="text-[10px]">
                {variables.length}
              </Badge>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showInputs && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            将上游节点的变量映射到代码中的参数
          </p>

          {variables.length === 0 ? (
            <div className="text-center py-4 border rounded-lg border-dashed">
              <p className="text-sm text-muted-foreground">暂无输入变量</p>
              <Button variant="link" size="sm" onClick={addInputVariable} className="mt-1">
                添加变量
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {variables.map((variable, index) => (
                <div
                  key={variable.id || index}
                  className="flex items-center gap-2 p-2 border rounded-lg bg-background"
                >
                  <Input
                    value={variable.key}
                    onChange={(e) => updateInputVariable(index, { ...variable, key: e.target.value })}
                    placeholder="参数名"
                    className="w-24 h-8 text-sm font-mono"
                  />
                  <span className="text-muted-foreground">=</span>
                  <div className="flex-1">
                    <VariableSelector
                      value={variable.value}
                      onChange={(value) => updateInputVariable(index, { ...variable, value })}
                      availableNodes={allNodes}
                      currentNodeId={node.id}
                      placeholder="选择变量"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteInputVariable(index)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={addInputVariable} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加输入变量
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Output Variables */}
      <Collapsible open={showOutputs} onOpenChange={setShowOutputs}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">输出变量</span>
              <Badge variant="secondary" className="text-[10px]">
                {outputs.length}
              </Badge>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform',
              showOutputs && 'rotate-180'
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            定义代码返回值中的变量及其类型
          </p>

          {outputs.length === 0 ? (
            <div className="text-center py-4 border rounded-lg border-dashed">
              <p className="text-sm text-muted-foreground">暂无输出变量</p>
              <Button variant="link" size="sm" onClick={addOutputVariable} className="mt-1">
                添加变量
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {outputs.map((output, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 border rounded-lg bg-background"
                >
                  <Input
                    value={output.key}
                    onChange={(e) => updateOutputVariable(index, { ...output, key: e.target.value })}
                    placeholder="变量名"
                    className="flex-1 h-8 text-sm font-mono"
                  />
                  <Select
                    value={output.type}
                    onValueChange={(type: VarType) => updateOutputVariable(index, { ...output, type })}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {outputTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteOutputVariable(index)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={addOutputVariable} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加输出变量
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Tips */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">提示</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>函数必须命名为 <code className="font-mono">main</code></li>
          <li>
            {language === CodeLanguage.Python3 
              ? '返回值必须是 dict 类型'
              : '返回值必须是对象类型'
            }
          </li>
          <li>输出变量名需要与返回值的 key 匹配</li>
        </ul>
      </div>
    </div>
  );
}
