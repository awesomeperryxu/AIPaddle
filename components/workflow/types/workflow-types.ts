import type { LucideIcon } from 'lucide-react';
import {
  BlockEnum,
  VarType,
  NodeCategory,
  NodeRunningStatus,
  ModelConfig,
  PromptTemplate,
  MemoryConfig,
  IfElseCase,
  KeyValueItem,
  CodeLanguage,
  HttpMethod,
  BodyType,
  ErrorHandleMode,
  RetrievalMode,
  ValueSelector,
  VariableDefinition,
  CodeOutputVariable,
} from './node-types';

/**
 * App type - workflow or chatflow
 */
export type AppType = 'workflow' | 'chatflow';

/**
 * Workflow status
 */
export type WorkflowStatus = 'draft' | 'published' | 'offline';

/**
 * Base node configuration interface
 */
export interface BaseNodeConfig {
  title?: string;
  description?: string;
}

// ===== Node-specific configurations =====

/**
 * Start node configuration
 */
export interface StartNodeConfig extends BaseNodeConfig {
  variables: VariableDefinition[];
}

/**
 * End node configuration
 */
export interface EndNodeConfig extends BaseNodeConfig {
  outputs: {
    key: string;
    value: ValueSelector;
  }[];
}

/**
 * LLM node configuration
 */
export interface LLMNodeConfig extends BaseNodeConfig {
  model: ModelConfig;
  prompts: PromptTemplate[];
  context?: {
    enabled: boolean;
    variable_selector?: ValueSelector;
  };
  memory?: MemoryConfig;
  vision?: {
    enabled: boolean;
    configs?: {
      variable_selector: ValueSelector;
      detail?: 'low' | 'high' | 'auto';
    };
  };
  result_format?: {
    type: 'text' | 'json_schema';
    json_schema?: Record<string, unknown>;
  };
}

/**
 * Agent node configuration
 */
export interface AgentNodeConfig extends BaseNodeConfig {
  model: ModelConfig;
  prompts: PromptTemplate[];
  tools: string[]; // Tool IDs
  max_iterations?: number;
  strategy?: 'react' | 'function-call';
}

/**
 * Question Classifier node configuration
 */
export interface QuestionClassifierConfig extends BaseNodeConfig {
  model: ModelConfig;
  query_variable: ValueSelector;
  classes: {
    id: string;
    name: string;
    description?: string;
  }[];
  instruction?: string;
}

/**
 * Parameter Extractor node configuration
 */
export interface ParameterExtractorConfig extends BaseNodeConfig {
  model: ModelConfig;
  query_variable: ValueSelector;
  parameters: {
    name: string;
    type: VarType;
    description: string;
    required: boolean;
  }[];
  instruction?: string;
  reasoning_mode?: 'prompt' | 'function_call';
}

/**
 * If-Else node configuration
 */
export interface IfElseNodeConfig extends BaseNodeConfig {
  cases: IfElseCase[];
}

/**
 * Iteration node configuration
 */
export interface IterationNodeConfig extends BaseNodeConfig {
  iterator_selector: ValueSelector;
  output_selector?: ValueSelector;
  parallel_mode?: boolean;
  max_parallelism?: number;
  error_handle_mode?: ErrorHandleMode;
  // Sub-workflow nodes within the iteration
  start_node_id?: string;
}

/**
 * Loop node configuration
 */
export interface LoopNodeConfig extends BaseNodeConfig {
  max_iterations: number;
  break_condition?: {
    variable: ValueSelector;
    condition: string;
  };
  loop_variables?: VariableDefinition[];
}

/**
 * Human Input node configuration
 */
export interface HumanInputConfig extends BaseNodeConfig {
  variables: VariableDefinition[];
  timeout?: number;
  timeout_branch?: 'default' | 'fail';
}

/**
 * Code node configuration
 */
export interface CodeNodeConfig extends BaseNodeConfig {
  language: CodeLanguage;
  code: string;
  variables: {
    key: string;
    value: ValueSelector;
  }[];
  outputs: CodeOutputVariable[];
  dependencies?: string[];
}

/**
 * Template Transform node configuration
 */
export interface TemplateTransformConfig extends BaseNodeConfig {
  template: string;
  variables: {
    key: string;
    value: ValueSelector;
  }[];
}

/**
 * Variable Assigner node configuration
 */
export interface VariableAssignerConfig extends BaseNodeConfig {
  write_mode: 'overwrite' | 'append' | 'clear';
  output_type: VarType;
  variables: ValueSelector[];
}

/**
 * Variable Aggregator node configuration
 */
export interface VariableAggregatorConfig extends BaseNodeConfig {
  variables: ValueSelector[];
  output_type: VarType;
  advanced_settings?: {
    group_enabled: boolean;
    groups: {
      output_type: VarType;
      variables: ValueSelector[];
    }[];
  };
}

/**
 * List Operator node configuration
 */
export interface ListOperatorConfig extends BaseNodeConfig {
  variable: ValueSelector;
  operation: 'first' | 'last' | 'slice' | 'filter' | 'sort' | 'limit' | 'reverse' | 'unique' | 'flatten';
  params?: {
    start?: number;
    end?: number;
    filter_condition?: string;
    sort_key?: string;
    sort_order?: 'asc' | 'desc';
    limit?: number;
  };
}

/**
 * Document Extractor node configuration
 */
export interface DocumentExtractorConfig extends BaseNodeConfig {
  variable: ValueSelector;
  extract_type?: 'full' | 'by_page';
}

/**
 * JSON Parse node configuration
 */
export interface JSONParseConfig extends BaseNodeConfig {
  variable: ValueSelector;
}

/**
 * HTTP Request node configuration
 */
export interface HttpRequestConfig extends BaseNodeConfig {
  method: HttpMethod;
  url: string;
  headers?: KeyValueItem[];
  params?: KeyValueItem[];
  body?: {
    type: BodyType;
    content?: string;
    data?: KeyValueItem[];
  };
  authorization?: {
    type: 'none' | 'api-key' | 'basic' | 'bearer' | 'custom';
    config?: Record<string, string>;
  };
  timeout?: number;
  retry?: {
    enabled: boolean;
    max_retries: number;
    retry_interval: number;
  };
}

/**
 * Tool node configuration
 */
export interface ToolNodeConfig extends BaseNodeConfig {
  tool_id: string;
  tool_name?: string;
  tool_parameters?: Record<string, ValueSelector | unknown>;
}

/**
 * Knowledge Retrieval node configuration
 */
export interface KnowledgeRetrievalConfig extends BaseNodeConfig {
  query_variable: ValueSelector;
  dataset_ids: string[];
  retrieval_mode: RetrievalMode;
  multiple_retrieval_config?: {
    top_k: number;
    score_threshold?: number;
    reranking_model?: {
      provider: string;
      model: string;
    };
  };
  single_retrieval_config?: {
    model?: {
      provider: string;
      name: string;
    };
  };
  metadata_filtering?: {
    filters: {
      key: string;
      operator: string;
      value: string | number | boolean;
    }[];
    logical_operator: 'and' | 'or';
  };
}

/**
 * Data Source node configuration
 */
export interface DataSourceConfig extends BaseNodeConfig {
  datasource_type: string;
  datasource_id?: string;
  query_template?: string;
  variables?: {
    key: string;
    value: ValueSelector;
  }[];
}

/**
 * Answer node configuration (Chatflow only)
 */
export interface AnswerNodeConfig extends BaseNodeConfig {
  answer: string; // Supports variable interpolation
  variables?: {
    key: string;
    value: ValueSelector;
  }[];
}

/**
 * Note node configuration
 */
export interface NoteNodeConfig {
  text: string;
  background_color?: string;
  width?: number;
  height?: number;
}

/**
 * Trigger Webhook node configuration
 */
export interface TriggerWebhookConfig extends BaseNodeConfig {
  method: HttpMethod;
  path?: string;
}

/**
 * Trigger Schedule node configuration
 */
export interface TriggerScheduleConfig extends BaseNodeConfig {
  schedule_type: 'cron' | 'interval';
  cron_expression?: string;
  interval_seconds?: number;
}

// Union type for all node configs
export type NodeConfig =
  | StartNodeConfig
  | EndNodeConfig
  | LLMNodeConfig
  | AgentNodeConfig
  | QuestionClassifierConfig
  | ParameterExtractorConfig
  | IfElseNodeConfig
  | IterationNodeConfig
  | LoopNodeConfig
  | HumanInputConfig
  | CodeNodeConfig
  | TemplateTransformConfig
  | VariableAssignerConfig
  | VariableAggregatorConfig
  | ListOperatorConfig
  | DocumentExtractorConfig
  | JSONParseConfig
  | HttpRequestConfig
  | ToolNodeConfig
  | KnowledgeRetrievalConfig
  | DataSourceConfig
  | AnswerNodeConfig
  | NoteNodeConfig
  | TriggerWebhookConfig
  | TriggerScheduleConfig;

/**
 * Workflow node structure
 */
export interface WorkflowNode {
  id: string;
  type: BlockEnum;
  title: string;
  description?: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  data: NodeConfig;
  runningStatus?: NodeRunningStatus;
  selected?: boolean;
  // For iteration/loop nodes - contains sub-nodes
  children?: string[];
}

/**
 * Edge/Connection between nodes
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  // For if-else branches
  sourceCase?: string;
  // Edge style
  type?: 'default' | 'success' | 'fail';
}

/**
 * Environment variable
 */
export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'secret';
  description?: string;
}

/**
 * Conversation variable (Chatflow only)
 */
export interface ConversationVariable {
  id: string;
  key: string;
  type: VarType;
  description?: string;
  defaultValue?: unknown;
}

/**
 * Viewport state
 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Complete workflow data structure
 */
export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  type: AppType;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: Viewport;
  environment_variables?: EnvironmentVariable[];
  conversation_variables?: ConversationVariable[]; // Chatflow only
  features?: {
    opening_statement?: string;
    suggested_questions?: string[];
    sensitive_word_avoidance?: {
      enabled: boolean;
      type?: string;
      configs?: Record<string, unknown>;
    };
    speech_to_text?: {
      enabled: boolean;
    };
    text_to_speech?: {
      enabled: boolean;
      voice?: string;
    };
    file_upload?: {
      enabled: boolean;
      allowed_file_types?: string[];
      max_files?: number;
    };
    citation?: {
      enabled: boolean;
    };
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Node registry entry - configuration for each node type
 */
export interface NodeRegistryEntry {
  type: BlockEnum;
  label: string;
  labelEn?: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  category: NodeCategory;
  description?: string;
  descriptionEn?: string;
  // Port configuration
  hasInputPort: boolean;
  hasOutputPort: boolean;
  outputPorts?: { id: string; label?: string }[];
  // Available in which app types
  availableIn: AppType[];
  // Default configuration
  defaultConfig: Partial<NodeConfig>;
  // Min/max instances
  minInstances?: number;
  maxInstances?: number;
}

/**
 * Node category group for sidebar
 */
export interface NodeCategoryGroup {
  id: NodeCategory;
  label: string;
  labelEn?: string;
  types: BlockEnum[];
}
