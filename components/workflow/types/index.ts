// Export all types from node-types
export {
  BlockEnum,
  VarType,
  NodeCategory,
  NodeRunningStatus,
  ComparisonOperator,
  LogicalOperator,
  HttpMethod,
  BodyType,
  CodeLanguage,
  ErrorHandleMode,
  RetrievalMode,
  MemoryRole,
} from './node-types';

export type {
  ModelProvider,
  ValueSelector,
  NodePort,
  VariableDefinition,
  Condition,
  ConditionGroup,
  IfElseCase,
  ModelConfig,
  PromptTemplate,
  MemoryConfig,
  KeyValueItem,
  CodeOutputVariable,
} from './node-types';

// Export all types from workflow-types
export type {
  AppType,
  WorkflowStatus,
  BaseNodeConfig,
  StartNodeConfig,
  EndNodeConfig,
  LLMNodeConfig,
  AgentNodeConfig,
  QuestionClassifierConfig,
  ParameterExtractorConfig,
  IfElseNodeConfig,
  IterationNodeConfig,
  LoopNodeConfig,
  HumanInputConfig,
  CodeNodeConfig,
  TemplateTransformConfig,
  VariableAssignerConfig,
  VariableAggregatorConfig,
  ListOperatorConfig,
  DocumentExtractorConfig,
  JSONParseConfig,
  HttpRequestConfig,
  ToolNodeConfig,
  KnowledgeRetrievalConfig,
  DataSourceConfig,
  AnswerNodeConfig,
  NoteNodeConfig,
  TriggerWebhookConfig,
  TriggerScheduleConfig,
  NodeConfig,
  WorkflowNode,
  WorkflowEdge,
  EnvironmentVariable,
  ConversationVariable,
  Viewport,
  WorkflowData,
  NodeRegistryEntry,
  NodeCategoryGroup,
} from './workflow-types';

// Common config panel props type
import type { WorkflowNode, VariableDefinition } from './workflow-types';

export interface NodeConfigProps {
  node: WorkflowNode;
  onUpdate: (updatedNode: WorkflowNode) => void;
  availableVariables: VariableDefinition[];
  allNodes?: WorkflowNode[];
}
