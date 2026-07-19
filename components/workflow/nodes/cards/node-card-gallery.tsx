'use client';

import * as React from 'react';
import {
  StartNodeCard,
  EndNodeCard,
  AnswerNodeCard,
  LLMNodeCard,
  AgentNodeCard,
  QuestionClassifierNodeCard,
  ParameterExtractorNodeCard,
  CodeNodeCard,
  TemplateTransformNodeCard,
  VariableAssignerNodeCard,
  ListOperatorNodeCard,
  DocumentExtractorNodeCard,
  KnowledgeRetrievalNodeCard,
  KnowledgeBaseNodeCard,
  DataSourceNodeCard,
  IfElseNodeCard,
  IterationNodeCard,
  LoopNodeCard,
  HttpRequestNodeCard,
  ToolNodeCard,
  HumanInputNodeCard,
  WebhookTriggerNodeCard,
  ScheduleTriggerNodeCard,
  PluginTriggerNodeCard,
  NoteNodeCard,
  ContainerMarkerNodeCard,
} from './node-cards';

interface CategorySection {
  title: string;
  titleEn: string;
  nodes: React.ReactNode[];
}

export function NodeCardGallery() {
  const categories: CategorySection[] = [
    {
      title: '基础流程节点',
      titleEn: 'Basic Flow Nodes',
      nodes: [
        <StartNodeCard
          key="start"
          variables={[
            { name: 'query', type: 'string' },
            { name: 'context', type: 'object' },
            { name: 'files', type: 'files' },
          ]}
        />,
        <EndNodeCard key="end" outputCount={3} />,
        <AnswerNodeCard
          key="answer"
          content="根据您的查询，以下是相关信息的总结..."
        />,
      ],
    },
    {
      title: 'LLM & AI 节点',
      titleEn: 'LLM & AI Nodes',
      nodes: [
        <LLMNodeCard
          key="llm"
          model="GPT-4o"
          promptPreview="你是一个专业的AI助手，帮助用户解答问题..."
        />,
        <AgentNodeCard
          key="agent"
          strategy="function-calling"
          toolCount={5}
        />,
        <QuestionClassifierNodeCard
          key="question-classifier"
          queryVariable="user_input"
          categoryCount={4}
        />,
        <ParameterExtractorNodeCard
          key="parameter-extractor"
          model="GPT-4o-mini"
          paramCount={6}
        />,
      ],
    },
    {
      title: '数据处理节点',
      titleEn: 'Data Processing Nodes',
      nodes: [
        <CodeNodeCard
          key="code"
          language="python3"
          codePreview="def main(inputs): return {...}"
        />,
        <TemplateTransformNodeCard
          key="template-transform"
          templatePreview="{{ user_name }} - {{ timestamp }}"
        />,
        <VariableAssignerNodeCard key="variable-assigner" ruleCount={3} />,
        <ListOperatorNodeCard key="list-operator" operation="filter" />,
        <DocumentExtractorNodeCard
          key="document-extractor"
          fileVariable="uploaded_file"
          parseMode="markdown"
        />,
      ],
    },
    {
      title: '知识与数据节点',
      titleEn: 'Knowledge & Data Nodes',
      nodes: [
        <KnowledgeRetrievalNodeCard
          key="knowledge-retrieval"
          knowledgeBaseCount={2}
          retrievalMode="multiple"
        />,
        <KnowledgeBaseNodeCard
          key="knowledge-base"
          knowledgeBaseName="产品文档知识库"
        />,
        <DataSourceNodeCard
          key="data-source"
          dataSourceName="MySQL Database"
          queryType="SQL"
        />,
      ],
    },
    {
      title: '逻辑控制节点',
      titleEn: 'Logic Control Nodes',
      nodes: [
        <IfElseNodeCard
          key="if-else"
          conditionPreview="intent == 'support'"
          elifCount={2}
        />,
        <IterationNodeCard
          key="iteration"
          inputArrayVariable="items"
          parallelMode
        />,
        <LoopNodeCard key="loop" variableCount={2} maxIterations={10} />,
      ],
    },
    {
      title: '集成节点',
      titleEn: 'Integration Nodes',
      nodes: [
        <HttpRequestNodeCard
          key="http-get"
          method="GET"
          url="https://api.example.com/data"
        />,
        <HttpRequestNodeCard
          key="http-post"
          method="POST"
          url="https://api.example.com/submit"
        />,
        <ToolNodeCard key="tool" toolName="Web Search" paramCount={3} />,
        <HumanInputNodeCard
          key="human-input"
          prompt="请审核以下内容是否正确"
          timeout={300}
        />,
      ],
    },
    {
      title: '触发器节点',
      titleEn: 'Trigger Nodes',
      nodes: [
        <WebhookTriggerNodeCard
          key="webhook"
          webhookUrl="https://workflow.app/hook/abc123"
        />,
        <ScheduleTriggerNodeCard
          key="schedule"
          cronExpression="0 9 * * MON-FRI"
          nextRunTime="2024-01-15 09:00"
        />,
        <PluginTriggerNodeCard
          key="plugin"
          pluginName="Slack Integration"
          version="2.1.0"
        />,
      ],
    },
    {
      title: '特殊节点',
      titleEn: 'Special Nodes',
      nodes: [
        <NoteNodeCard
          key="note-yellow"
          content="这是一个重要的备注信息，用于说明这个流程的目的和注意事项。"
          theme="yellow"
          author="Admin"
        />,
        <NoteNodeCard
          key="note-blue"
          content="API 接口文档链接和参数说明"
          theme="blue"
          width={180}
          height={100}
        />,
        <NoteNodeCard
          key="note-green"
          content="已完成的步骤"
          theme="green"
          width={160}
          height={80}
        />,
      ],
    },
    {
      title: '容器标记节点',
      titleEn: 'Container Marker Nodes',
      nodes: [
        <ContainerMarkerNodeCard key="iter-start" type="iteration-start" />,
        <ContainerMarkerNodeCard key="loop-start" type="loop-start" />,
        <ContainerMarkerNodeCard key="loop-end" type="loop-end" />,
      ],
    },
    {
      title: '迭代/循环容器示例',
      titleEn: 'Container Examples',
      nodes: [
        <IterationNodeCard
          key="iteration-container"
          inputArrayVariable="documents"
          isContainer
        />,
        <LoopNodeCard
          key="loop-container"
          variableCount={3}
          maxIterations={5}
          isContainer
        />,
      ],
    },
    {
      title: '节点状态示例',
      titleEn: 'Node Status Examples',
      nodes: [
        <LLMNodeCard
          key="llm-running"
          title="LLM (运行中)"
          model="GPT-4"
          status="running"
        />,
        <CodeNodeCard
          key="code-success"
          title="代码 (成功)"
          language="javascript"
          status="succeeded"
        />,
        <HttpRequestNodeCard
          key="http-failed"
          title="HTTP (失败)"
          method="POST"
          url="https://api.error.com"
          status="failed"
        />,
        <AgentNodeCard
          key="agent-retry"
          title="Agent (重试)"
          strategy="react"
          toolCount={3}
          status="retry"
        />,
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">节点卡片展示</h1>
          <p className="mt-1 text-muted-foreground">
            工作流编辑器中所有 30 种节点类型的卡片 UI
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-10">
          {categories.map((category, idx) => (
            <section key={idx}>
              {/* Category Header */}
              <div className="mb-4 border-b pb-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {category.title}
                </h2>
                <p className="text-sm text-muted-foreground">{category.titleEn}</p>
              </div>

              {/* Node Grid */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {category.nodes.map((node, nodeIdx) => (
                  <div key={nodeIdx} className="flex justify-center">
                    {node}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
