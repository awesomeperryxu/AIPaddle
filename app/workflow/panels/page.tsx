'use client';

import { useState } from 'react';
import { Sparkles, Code2, GitBranch, Globe, BookOpen, RefreshCw, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LLMConfigPanelV2,
  CodeConfigPanelV2,
  IfElseConfigPanelV2,
  HttpConfigPanelV2,
  KnowledgeConfigPanelV2,
  IterationConfigPanelV2,
  LoopConfigPanelV2,
} from '@/components/workflow/panels/configs/v2';
import type { WorkflowNode } from '@/components/workflow/types';

// Mock nodes for demo
const mockNodes: WorkflowNode[] = [
  {
    id: 'start',
    type: 'start' as any,
    title: 'Start',
    position: { x: 0, y: 0 },
    data: {},
  },
  {
    id: 'llm-1',
    type: 'llm' as any,
    title: 'LLM',
    position: { x: 200, y: 0 },
    data: {},
  },
  {
    id: 'code-1',
    type: 'code' as any,
    title: 'Code',
    position: { x: 400, y: 0 },
    data: {},
  },
  {
    id: 'ifelse-1',
    type: 'if-else' as any,
    title: 'IfElse',
    position: { x: 600, y: 0 },
    data: {},
  },
  {
    id: 'http-1',
    type: 'http-request' as any,
    title: 'HTTP Request',
    position: { x: 800, y: 0 },
    data: {},
  },
  {
    id: 'knowledge-1',
    type: 'knowledge-retrieval' as any,
    title: 'Knowledge Retrieval',
    position: { x: 1000, y: 0 },
    data: {},
  },
  {
    id: 'iteration-1',
    type: 'iteration' as any,
    title: 'Iteration',
    position: { x: 1200, y: 0 },
    data: {},
  },
  {
    id: 'loop-1',
    type: 'loop' as any,
    title: 'Loop',
    position: { x: 1400, y: 0 },
    data: {},
  },
];

type PanelType = 'llm' | 'code' | 'ifelse' | 'http' | 'knowledge' | 'iteration' | 'loop' | null;

export default function PanelsDemoPage() {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [appType, setAppType] = useState<'workflow' | 'chatflow'>('workflow');

  const panels = [
    {
      id: 'llm' as PanelType,
      title: 'LLM 节点面板',
      icon: <Sparkles className="h-5 w-5" />,
      color: '#7C3AED',
      description: '模型选择、提示词配置、参数设置',
    },
    {
      id: 'code' as PanelType,
      title: 'Code 节点面板',
      icon: <Code2 className="h-5 w-5" />,
      color: '#F59E0B',
      description: 'Python/JavaScript 代码编辑',
    },
    {
      id: 'ifelse' as PanelType,
      title: 'IfElse 节点面板',
      icon: <GitBranch className="h-5 w-5" />,
      color: '#3B82F6',
      description: '条件分支配置',
    },
    {
      id: 'http' as PanelType,
      title: 'HTTP 节点面板',
      icon: <Globe className="h-5 w-5" />,
      color: '#EF4444',
      description: 'HTTP 请求配置',
    },
    {
      id: 'knowledge' as PanelType,
      title: 'Knowledge 节点面板',
      icon: <BookOpen className="h-5 w-5" />,
      color: '#06B6D4',
      description: '知识库检索配置',
    },
    {
      id: 'iteration' as PanelType,
      title: 'Iteration 节点面板',
      icon: <RefreshCw className="h-5 w-5" />,
      color: '#3B82F6',
      description: '迭代容器配置',
    },
    {
      id: 'loop' as PanelType,
      title: 'Loop 节点面板',
      icon: <Repeat className="h-5 w-5" />,
      color: '#8B5CF6',
      description: '循环容器配置',
    },
  ];

  const handleUpdate = (data: any) => {
    console.log('[v0] Panel update:', data);
  };

  const handleSave = () => {
    console.log('[v0] Panel saved');
    setActivePanel(null);
  };

  const handleReset = () => {
    console.log('[v0] Panel reset');
  };

  return (
    <div className="min-h-screen bg-muted/30 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">节点配置面板 Demo</h1>
          <p className="text-muted-foreground">
            点击下方卡片打开对应的节点配置面板（380px 右侧抽屉）
          </p>
        </div>

        {/* App Type Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">应用类型:</span>
          <div className="flex gap-2">
            <Button
              variant={appType === 'workflow' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAppType('workflow')}
            >
              Workflow
            </Button>
            <Button
              variant={appType === 'chatflow' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAppType('chatflow')}
            >
              Chatflow
            </Button>
          </div>
          <Badge variant="secondary" className="text-xs">
            Chatflow 模式下 LLM 节点显示"对话记忆"选项
          </Badge>
        </div>

        {/* Panel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              className="p-6 border rounded-xl bg-background hover:border-primary/50 hover:shadow-md transition-all text-left group"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: `${panel.color}20` }}
              >
                <span style={{ color: panel.color }}>{panel.icon}</span>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                {panel.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {panel.description}
              </p>
            </button>
          ))}
        </div>

        {/* Instructions */}
        <div className="p-4 border rounded-lg bg-background">
          <h3 className="font-medium mb-2">面板规格说明</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- 面板宽度: 380px，右侧抽屉形式</li>
            <li>- Header: 节点主题色浅背景，包含图标、标题、类型徽章、关闭按钮</li>
            <li>- Tab 栏: 下划线激活样式（部分面板无 Tab）</li>
            <li>- 内容区: overflow-y-auto 滚动</li>
            <li>- Footer: 重置（outline）+ 保存（primary）按钮</li>
          </ul>
        </div>
      </div>

      {/* LLM Panel */}
      <LLMConfigPanelV2
        node={mockNodes[1]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'llm'}
        appType={appType}
      />

      {/* Code Panel */}
      <CodeConfigPanelV2
        node={mockNodes[2]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'code'}
        appType={appType}
      />

      {/* IfElse Panel */}
      <IfElseConfigPanelV2
        node={mockNodes[3]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'ifelse'}
        appType={appType}
      />

      {/* HTTP Panel */}
      <HttpConfigPanelV2
        node={mockNodes[4]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'http'}
      />

      {/* Knowledge Panel */}
      <KnowledgeConfigPanelV2
        node={mockNodes[5]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'knowledge'}
      />

      {/* Iteration Panel */}
      <IterationConfigPanelV2
        node={mockNodes[6]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'iteration'}
      />

      {/* Loop Panel */}
      <LoopConfigPanelV2
        node={mockNodes[7]}
        allNodes={mockNodes}
        onUpdate={handleUpdate}
        onClose={() => setActivePanel(null)}
        onSave={handleSave}
        onReset={handleReset}
        isOpen={activePanel === 'loop'}
      />
    </div>
  );
}
