// Node types following Dify's structure with complete 30+ node types

/**
 * BlockEnum - Complete node type enumeration
 * Organized by category for better maintainability
 */
export enum BlockEnum {
  // ===== Trigger Nodes =====
  Start = 'start',
  TriggerWebhook = 'trigger-webhook',
  TriggerSchedule = 'trigger-schedule',
  TriggerPlugin = 'trigger-plugin',

  // ===== AI Nodes =====
  LLM = 'llm',
  Agent = 'agent',
  QuestionClassifier = 'question-classifier',
  ParameterExtractor = 'parameter-extractor',

  // ===== Logic Control Nodes =====
  IfElse = 'if-else',
  Iteration = 'iteration',
  Loop = 'loop',
  HumanInput = 'human-input',

  // ===== Data Processing Nodes =====
  Code = 'code',
  TemplateTransform = 'template-transform',
  VariableAssigner = 'variable-assigner',
  VariableAggregator = 'variable-aggregator',
  ListOperator = 'list-operator',
  DocumentExtractor = 'document-extractor',
  JSONParse = 'json-parse',

  // ===== Integration Nodes =====
  HttpRequest = 'http-request',
  Tool = 'tool',
  KnowledgeRetrieval = 'knowledge-retrieval',
  DataSource = 'data-source',
  KnowledgeBase = 'knowledge-base',

  // ===== Output Nodes =====
  End = 'end',
  Answer = 'answer', // Chatflow only

  // ===== Special Nodes =====
  Note = 'note',
  AssignerWriteTo = 'assigner-write-to',
}

/**
 * Variable type definitions
 */
export enum VarType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
  ArrayString = 'array[string]',
  ArrayNumber = 'array[number]',
  ArrayObject = 'array[object]',
  File = 'file',
  Files = 'files',
  Any = 'any',
}

/**
 * Node category for grouping in sidebar
 */
export enum NodeCategory {
  Trigger = 'trigger',
  AI = 'ai',
  Logic = 'logic',
  Data = 'data',
  Integration = 'integration',
  Output = 'output',
  Special = 'special',
}

/**
 * Node running status
 */
export enum NodeRunningStatus {
  Waiting = 'waiting',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Paused = 'paused',
  Skipped = 'skipped',
}

/**
 * Comparison operators for conditions
 */
export enum ComparisonOperator {
  Contains = 'contains',
  NotContains = 'not-contains',
  StartsWith = 'starts-with',
  EndsWith = 'ends-with',
  Is = 'is',
  IsNot = 'is-not',
  Empty = 'empty',
  NotEmpty = 'not-empty',
  Equals = '=',
  NotEquals = '!=',
  GreaterThan = '>',
  GreaterThanOrEqual = '>=',
  LessThan = '<',
  LessThanOrEqual = '<=',
  In = 'in',
  NotIn = 'not-in',
  AllOf = 'all-of',
  Exists = 'exists',
  NotExists = 'not-exists',
}

/**
 * Logical operators for combining conditions
 */
export enum LogicalOperator {
  And = 'and',
  Or = 'or',
}

/**
 * HTTP methods
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

/**
 * Body type for HTTP requests
 */
export enum BodyType {
  None = 'none',
  FormData = 'form-data',
  XWwwFormUrlencoded = 'x-www-form-urlencoded',
  RawText = 'raw-text',
  JSON = 'json',
  Binary = 'binary',
}

/**
 * Code language for code nodes
 */
export enum CodeLanguage {
  Python3 = 'python3',
  JavaScript = 'javascript',
}

/**
 * Error handling strategy
 */
export enum ErrorHandleMode {
  None = 'none',
  DefaultValue = 'default-value',
  FailBranch = 'fail-branch',
  Continue = 'continue',
}

/**
 * Retrieval mode for knowledge retrieval
 */
export enum RetrievalMode {
  Single = 'single',
  Multiple = 'multiple',
}

/**
 * Memory type for LLM nodes in Chatflow
 */
export enum MemoryRole {
  User = 'user',
  Assistant = 'assistant',
}

/**
 * Model provider types
 */
export type ModelProvider = 
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure'
  | 'bedrock'
  | 'deepseek'
  | 'zhipu'
  | 'qwen'
  | 'minimax'
  | 'baichuan'
  | 'moonshot'
  | 'custom';

/**
 * Value selector path - used for referencing variables from other nodes
 * Format: [nodeId, outputKey] or [nodeId, outputKey, subPath...]
 */
export type ValueSelector = string[];

/**
 * Port definition for node connections
 */
export interface NodePort {
  id: string;
  type: 'input' | 'output';
  label?: string;
  varType?: VarType;
  required?: boolean;
}

/**
 * Variable definition for node inputs/outputs
 */
export interface VariableDefinition {
  key: string;
  label?: string;
  type: VarType;
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
  options?: { value: string; label: string }[]; // For select type inputs
  maxLength?: number; // For string inputs
}

/**
 * Condition definition for if-else and other logic nodes
 */
export interface Condition {
  id: string;
  variable: ValueSelector;
  operator: ComparisonOperator;
  value: string | number | boolean | ValueSelector;
  varType?: VarType;
}

/**
 * Condition group with logical operator
 */
export interface ConditionGroup {
  id: string;
  logicalOperator: LogicalOperator;
  conditions: Condition[];
}

/**
 * Case definition for if-else branches
 */
export interface IfElseCase {
  id: string;
  caseId: string;
  logicalOperator: LogicalOperator;
  conditions: ConditionGroup[];
}

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: ModelProvider;
  name: string;
  mode?: 'chat' | 'completion';
  completion_params?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
  };
}

/**
 * Prompt template
 */
export interface PromptTemplate {
  id: string;
  role: 'system' | 'user' | 'assistant';
  text: string;
  edition_type?: 'basic' | 'jinja2';
}

/**
 * Memory configuration for Chatflow
 */
export interface MemoryConfig {
  role_prefix?: {
    user?: string;
    assistant?: string;
  };
  window?: {
    enabled: boolean;
    size: number;
  };
  query_prompt_template?: string;
}

/**
 * HTTP request header/param item
 */
export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  type?: VarType;
  enabled?: boolean;
}

/**
 * Code node output variable
 */
export interface CodeOutputVariable {
  key: string;
  type: VarType;
  children?: CodeOutputVariable[]; // For nested objects
}
