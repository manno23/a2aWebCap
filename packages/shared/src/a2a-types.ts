/**
 * A2A Protocol Type Definitions (v0.4.0)
 * Based on the Agent-to-Agent communication protocol specification
 */

// ============================================================================
// Core Message Types
// ============================================================================

export interface Message {
  messageId: string;
  contextId?: string;
  taskId?: string;
  role: 'user' | 'agent';
  parts: Part[];
  metadata?: Record<string, any>;
}

export type Part = TextPart | FilePart | DataPart;

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface FilePart {
  kind: 'file';
  file: FileData;
}

export interface FileData {
  name?: string;
  mimeType?: string;
  bytes?: string;  // base64 encoded
  uri?: string;
}

export interface DataPart {
  kind: 'data';
  data: any;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolCall {
  callId: string;
  name: string;
  input?: Record<string, any>;
  status: ToolStatus;
  result?: any;
  error?: string;
  timestamp?: string;
}

export type ToolStatus =
  | 'validating'
  | 'scheduled'
  | 'awaiting-approval'
  | 'executing'
  | 'success'
  | 'error'
  | 'cancelled';

export interface ToolResult {
  callId: string;
  success: boolean;
  result?: any;
  error?: string;
}

// ============================================================================
// Task Types
// ============================================================================

export interface Task {
  id: string;
  contextId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
  kind: 'task';
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

export enum TaskState {
  Submitted = 'submitted',
  Working = 'working',
  InputRequired = 'input-required',
  Completed = 'completed',
  Canceled = 'canceled',
  Failed = 'failed',
  Rejected = 'rejected',
  AuthRequired = 'auth-required',
  Unknown = 'unknown'
}

// ============================================================================
// Artifact Types
// ============================================================================

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, any>;
}

// ============================================================================
// AgentCard Types
// ============================================================================

export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  preferredTransport?: string;
  additionalInterfaces?: AgentInterface[];
  capabilities?: AgentCapabilities;
  authentication?: AuthenticationScheme[];
  metadata?: Record<string, any>;
}

export interface AgentInterface {
  url: string;
  transport: string;
  metadata?: Record<string, any>;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  bidirectional?: boolean;
  taskManagement?: boolean;
  fileTransfer?: boolean;
  [key: string]: any;
}

export interface AuthenticationScheme {
  type: 'bearer' | 'apikey' | 'oauth2' | 'mtls' | 'custom';
  description?: string;
  parameters?: Record<string, any>;
}

// ============================================================================
// Request/Response Types for A2A Methods
// ============================================================================

export interface MessageSendRequest {
  message: Message;
  config?: MessageSendConfig;
}

export interface MessageSendConfig {
  pushNotification?: PushNotificationConfig;
  metadata?: Record<string, any>;
}

export interface PushNotificationConfig {
  url?: string;
  headers?: Record<string, string>;
  callback?: any; // For capnweb, this will be TaskUpdateCallback
}

export type MessageSendResponse = Task | Message;

export interface TaskGetRequest {
  taskId: string;
  historyLength?: number;
}

export type TaskGetResponse = Task;

export interface TaskListRequest {
  contextId?: string;
  limit?: number;
  offset?: number;
  filter?: TaskFilter;
}

export interface TaskFilter {
  states?: TaskState[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface TaskListResponse {
  tasks: Task[];
  total?: number;
  hasMore?: boolean;
}

export interface TaskCancelRequest {
  taskId: string;
}

export type TaskCancelResponse = Task;

// ============================================================================
// Streaming Event Types
// ============================================================================

export type StreamEvent = StatusUpdateEvent | ArtifactUpdateEvent;

export interface StatusUpdateEvent {
  type: 'status';
  taskId: string;
  contextId: string;
  status: TaskStatus;
  final?: boolean;
}

export interface ArtifactUpdateEvent {
  type: 'artifact';
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface AuthCredentials {
  type: 'bearer' | 'apikey' | 'oauth2' | 'mtls' | 'custom';
  token?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  certificate?: string;
  [key: string]: any;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  permissions?: string[];
  expiresAt?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

export class A2AError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'A2AError';
  }
}

export enum A2AErrorCode {
  InvalidRequest = 'INVALID_REQUEST',
  TaskNotFound = 'TASK_NOT_FOUND',
  Unauthorized = 'UNAUTHORIZED',
  Forbidden = 'FORBIDDEN',
  RateLimitExceeded = 'RATE_LIMIT_EXCEEDED',
  InternalError = 'INTERNAL_ERROR',
  NotImplemented = 'NOT_IMPLEMENTED',
  ServiceUnavailable = 'SERVICE_UNAVAILABLE'
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ListTasksParams {
  contextId?: string;
  limit?: number;
  offset?: number;
  filter?: TaskFilter;
}

export interface ListTasksResult {
  tasks: Task[];
  total?: number;
  hasMore?: boolean;
}
