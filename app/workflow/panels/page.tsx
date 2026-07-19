'use client';

import { useState } from 'react';
import {
  Sparkles,
  Code2,
  GitBranch,
  Globe,
  BookOpen,
  RefreshCw,
  Repeat,
  Bot,
  MessageSquare,
  Square,
  HelpCircle,
  Sliders,
  FileText,
  ArrowLeftRight,
  UserCheck,
  Webhook,
  Clock,
} from 'lucide-react';
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
  AgentConfigPanelV2,
  AnswerConfigPanelV2,
  EndConfigPanelV2,
  QuestionClassifierConfigPanelV2,
  ParameterExtractorConfigPanelV2,
  TemplateTransformConfigPanelV2,
  VariableAssignerConfigPanelV2,
  HumanInputConfigPanelV2,
  TriggerWebhookConfigPanelV2,
  TriggerScheduleConfigPanelV2,
} from '@/components/workflow/panels/configs/v2';
import type { WorkflowNode } from '@/components/workflow/types';

// Mock nodes for demo (using `as any` to bypass strict type checking for demo purposes)
const mockNodes = [
  { id: 'start', type: 'start', title: 'Start', position: { x: 0, y: 0 }, data: {} },
  { id: 'llm-1', type: 'llm', title: 'LLM', position: { x: 200, y: 0 }, data: {} },
  { id: 'code-1', type: 'code', title: 'Code', position: { x: 400, y: 0 }, data: {} },
  { id: 'ifelse-1', type: 'if-else', title: 'IfElse', position: { x: 600, y: 0 }, data: {} },
  { id: 'http-1', type: 'http-request', title: 'HTTP', position: { x: 800, y: 0 }, data: {} },
  { id: 'knowledge-1', type: 'knowledge-retrieval', title: 'Knowledge', position: { x: 1000, y: 0 }, data: {} },
  { id: 'iteration-1', type: 'iteration', title: 'Iteration', position: { x: 1200, y: 0 }, data: {} },
  { id: 'loop-1', type: 'loop', title: 'Loop', position: { x: 1400, y: 0 }, data: {} },
  { id: 'agent-1', type: 'agent', title: 'Agent', position: { x: 0, y: 200 }, data: {} },
  { id: 'answer-1', type: 'answer', title: 'Answer', position: { x: 200, y: 200 }, data: {} },
  { id: 'end-1', type: 'end', title: 'End', position: { x: 400, y: 200 }, data: {} },
  { id: 'qc-1', type: 'question-classifier', title: 'QC', position: { x: 600, y: 200 }, data: {} },
  { id: 'pe-1', type: 'parameter-extractor', title: 'PE', position: { x: 800, y: 200 }, data: {} },
  { id: 'template-1', type: 'template-transform', title: 'Template', position: { x: 1000, y: 200 }, data: {} },
  { id: 'assigner-1', type: 'variable-assigner', title: 'Assigner', position: { x: 1200, y: 200 }, data: {} },
  { id: 'human-1', type: 'human-input', title: 'Human', position: { x: 1400, y: 200 }, data: {} },
  { id: 'webhook-1', type: 'trigger-webhook', title: 'Webhook', position: { x: 0, y: 400 }, data: {} },
  { id: 'schedule-1', type: 'trigger-schedule', title: 'Schedule', position: { x: 200, y: 400 }, data: {} },
] as WorkflowNode[];

type PanelType = 
  | 'llm' | 'code' | 'ifelse' | 'http' | 'knowledge' | 'iteration' | 'loop'
  | 'agent' | 'answer' | 'end' | 'qc' | 'pe' | 'template' | 'assigner' | 'human'
  | 'webhook' | 'schedule'
  | null;

export default function PanelsDemoPage() {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [appType, setAppType] = useState<'workflow' | 'chatflow'>('workflow');

  const panelGroups = [
    {
      title: 'Core Nodes (Steps 4-5)',
      panels: [
        { id: 'llm' as PanelType, title: 'LLM', icon: <Sparkles className="h-5 w-5" />, color: '#7C3AED', description: '模型选择、提示词配置' },
        { id: 'code' as PanelType, title: 'Code', icon: <Code2 className="h-5 w-5" />, color: '#F59E0B', description: 'Python/JS 代码编辑' },
        { id: 'ifelse' as PanelType, title: 'IfElse', icon: <GitBranch className="h-5 w-5" />, color: '#3B82F6', description: '条件分支配置' },
        { id: 'http' as PanelType, title: 'HTTP', icon: <Globe className="h-5 w-5" />, color: '#EF4444', description: 'HTTP 请求配置' },
        { id: 'knowledge' as PanelType, title: 'Knowledge', icon: <BookOpen className="h-5 w-5" />, color: '#06B6D4', description: '知识库检索配置' },
        { id: 'iteration' as PanelType, title: 'Iteration', icon: <RefreshCw className="h-5 w-5" />, color: '#3B82F6', description: '迭代容器配置' },
        { id: 'loop' as PanelType, title: 'Loop', icon: <Repeat className="h-5 w-5" />, color: '#8B5CF6', description: '循环容器配置' },
      ],
    },
    {
      title: 'Additional Nodes (Step 6)',
      panels: [
        { id: 'agent' as PanelType, title: 'Agent', icon: <Bot className="h-5 w-5" />, color: '#6366F1', description: 'Agent 策略配置' },
        { id: 'answer' as PanelType, title: 'Answer', icon: <MessageSquare className="h-5 w-5" />, color: '#2970FF', description: '回复内容 (Chatflow)' },
        { id: 'end' as PanelType, title: 'End', icon: <Square className="h-5 w-5" />, color: '#6B7280', description: '结束节点输出映射' },
        { id: 'qc' as PanelType, title: 'Question Classifier', icon: <HelpCircle className="h-5 w-5" />, color: '#F59E0B', description: '问题分类配置' },
        { id: 'pe' as PanelType, title: 'Parameter Extractor', icon: <Sliders className="h-5 w-5" />, color: '#F59E0B', description: '参数提取配置' },
        { id: 'template' as PanelType, title: 'Template', icon: <FileText className="h-5 w-5" />, color: '#F59E0B', description: 'Jinja2 模板转换' },
        { id: 'assigner' as PanelType, title: 'Assigner', icon: <ArrowLeftRight className="h-5 w-5" />, color: '#64748B', description: '变量赋值配置' },
        { id: 'human' as PanelType, title: 'Human Input', icon: <UserCheck className="h-5 w-5" />, color: '#2970FF', description: '人工输入配置' },
      ],
    },
    {
      title: 'Trigger Nodes',
      panels: [
        { id: 'webhook' as PanelType, title: 'Webhook Trigger', icon: <Webhook className="h-5 w-5" />, color: '#F97316', description: 'Webhook 触发配置' },
        { id: 'schedule' as PanelType, title: 'Schedule Trigger', icon: <Clock className="h-5 w-5" />, color: '#F97316', description: '定时触发配置' },
      ],
    },
  ];

  const handleUpdate = (data: unknown) => {
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
      <div className="max-w-6xl mx-auto space-y-8">
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
            Chatflow 模式下部分节点显示额外选项
          </Badge>
        </div>

        {/* Panel Groups */}
        {panelGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">{group.title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {group.panels.map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => setActivePanel(panel.id)}
                  className="p-4 border rounded-lg bg-background hover:border-primary/50 hover:shadow-md transition-all text-left group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${panel.color}20` }}
                  >
                    <span style={{ color: panel.color }}>{panel.icon}</span>
                  </div>
                  <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                    {panel.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {panel.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}

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

      {/* All Panels */}
      <LLMConfigPanelV2 node={mockNodes[1]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'llm'} appType={appType} />
      <CodeConfigPanelV2 node={mockNodes[2]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'code'} appType={appType} />
      <IfElseConfigPanelV2 node={mockNodes[3]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'ifelse'} appType={appType} />
      <HttpConfigPanelV2 node={mockNodes[4]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'http'} />
      <KnowledgeConfigPanelV2 node={mockNodes[5]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'knowledge'} />
      <IterationConfigPanelV2 node={mockNodes[6]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'iteration'} />
      <LoopConfigPanelV2 node={mockNodes[7]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'loop'} />
      <AgentConfigPanelV2 node={mockNodes[8]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'agent'} appType={appType} />
      <AnswerConfigPanelV2 node={mockNodes[9]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'answer'} />
      <EndConfigPanelV2 node={mockNodes[10]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'end'} />
      <QuestionClassifierConfigPanelV2 node={mockNodes[11]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'qc'} />
      <ParameterExtractorConfigPanelV2 node={mockNodes[12]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'pe'} />
      <TemplateTransformConfigPanelV2 node={mockNodes[13]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'template'} />
      <VariableAssignerConfigPanelV2 node={mockNodes[14]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'assigner'} />
      <HumanInputConfigPanelV2 node={mockNodes[15]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'human'} />
      <TriggerWebhookConfigPanelV2 node={mockNodes[16]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} isOpen={activePanel === 'webhook'} />
      <TriggerScheduleConfigPanelV2 node={mockNodes[17]} allNodes={mockNodes} onUpdate={handleUpdate} onClose={() => setActivePanel(null)} onSave={handleSave} onReset={handleReset} isOpen={activePanel === 'schedule'} />
    </div>
  );
}
