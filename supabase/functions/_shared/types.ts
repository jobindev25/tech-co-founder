// Shared TypeScript types for the automated development pipeline

export interface Project {
  id: number;
  conversation_id: string;
  project_name: string;
  project_description?: string;
  conversation_summary?: string;
  project_plan?: ProjectPlan;
  kiro_build_id?: string;
  kiro_project_id?: string;
  status: ProjectStatus;
  priority: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  metadata: Record<string, any>;
}

export type ProjectStatus = 
  | 'analyzing' 
  | 'planning' 
  | 'ready_to_build' 
  | 'building' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface ProjectPlan {
  name: string;
  description: string;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string;
    deployment: string;
  };
  features: Feature[];
  architecture: {
    type: 'monolith' | 'microservices' | 'serverless';
    components: Component[];
  };
  timeline: {
    estimated_hours: number;
    phases: Phase[];
  };
  fileStructure: FileNode[];
  dependencies: Dependency[];
  kiroConfig?: KiroConfig;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: number;
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface Component {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'service';
  description: string;
  technologies: string[];
  dependencies: string[];
}

export interface Phase {
  name: string;
  description: string;
  estimated_hours: number;
  tasks: string[];
  dependencies: string[];
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
  template?: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
  description?: string;
}

export interface KiroConfig {
  projectType: string;
  buildSettings: Record<string, any>;
  deploymentSettings: Record<string, any>;
  webhookSettings: {
    url: string;
    events: string[];
  };
}

export interface BuildEvent {
  id: number;
  project_id: number;
  kiro_build_id?: string;
  event_type: BuildEventType;
  event_data: Record<string, any>;
  message?: string;
  timestamp: string;
  sequence_number?: number;
}

export type BuildEventType = 
  | 'build_started' 
  | 'build_progress' 
  | 'build_completed' 
  | 'build_failed' 
  | 'build_cancelled' 
  | 'log_entry' 
  | 'file_generated';

export interface QueueTask {
  id: number;
  task_type: TaskType;
  task_data: Record<string, any>;
  status: TaskStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export type TaskType = 
  | 'analyze_conversation' 
  | 'generate_plan' 
  | 'trigger_build' 
  | 'process_webhook' 
  | 'send_notification';

export type TaskStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface ConversationAnalysis {
  projectName: string;
  description: string;
  summary: string;
  requirements: string[];
  features: string[];
  preferences: {
    techStack?: string[];
    timeline?: string;
    budget?: string;
    complexity?: 'simple' | 'medium' | 'complex';
  };
  extractedEntities: {
    technologies: string[];
    integrations: string[];
    platforms: string[];
  };
}

export interface KiroAPIRequest {
  name: string;
  description: string;
  techStack: {
    frontend: string;
    backend: string;
    database: string;
  };
  features: {
    name: string;
    description: string;
    priority: number;
  }[];
  architecture: string;
  timeline: number;
  webhook_url: string;
  real_time_updates: boolean;
  metadata: Record<string, any>;
}

export interface KiroAPIResponse {
  build_id: string;
  project_id: string;
  status: string;
  estimated_completion: string;
  webhook_configured: boolean;
}

export interface KiroWebhookPayload {
  build_id: string;
  project_id: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface APIUsage {
  id: number;
  api_name: 'tavus' | 'openai' | 'claude' | 'kiro';
  endpoint: string;
  request_count: number;
  response_time_ms: number;
  status_code: number;
  created_at: string;
  user_id?: string;
  project_id?: number;
}

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: any;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Error types
export class PipelineError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class AIAnalysisError extends PipelineError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AI_ANALYSIS_ERROR', context, true);
    this.name = 'AIAnalysisError';
  }
}

export class KiroAPIError extends PipelineError {
  constructor(message: string, statusCode: number, context?: Record<string, any>) {
    super(message, 'KIRO_API_ERROR', { statusCode, ...context }, statusCode >= 500);
    this.name = 'KiroAPIError';
  }
}

export class DatabaseError extends PipelineError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', context, true);
    this.name = 'DatabaseError';
  }
}

// Utility types
export interface RetryConfig {
  maxRetries: number;
  delays: number[];
  backoffMultiplier: number;
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  skipSuccessfulRequests: boolean;
}

export interface WebhookSignature {
  timestamp: string;
  signature: string;
  body: string;
}

// Broadcast event types for real-time updates
export interface BroadcastEvent {
  event_type: string;
  event_data: Record<string, any>;
  project_id: number;
  user_id?: string;
  channel: BroadcastChannel;
  message: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export type BroadcastChannel = 
  | 'project_updates' 
  | 'build_events' 
  | 'user_notifications' 
  | 'system_alerts';