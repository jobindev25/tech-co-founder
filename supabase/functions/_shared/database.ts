// Shared database utilities for the automated development pipeline

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  Project, 
  BuildEvent, 
  QueueTask, 
  APIUsage, 
  SystemConfig,
  ProjectStatus,
  TaskType,
  TaskStatus,
  BuildEventType,
  DatabaseError
} from './types.ts';

// Initialize Supabase client
export const createSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

// Project operations
export class ProjectService {
  constructor(private supabase: SupabaseClient) {}

  async createProject(data: Partial<Project>): Promise<Project> {
    try {
      const { data: project, error } = await this.supabase
        .from('projects')
        .insert([data])
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to create project: ${error.message}`, { data });
      return project;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error creating project: ${error.message}`, { data });
    }
  }

  async getProject(id: number): Promise<Project | null> {
    try {
      const { data: project, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to get project: ${error.message}`, { id });
      }
      
      return project;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting project: ${error.message}`, { id });
    }
  }

  async getProjectByConversationId(conversationId: string): Promise<Project | null> {
    try {
      const { data: project, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to get project by conversation: ${error.message}`, { conversationId });
      }
      
      return project;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting project by conversation: ${error.message}`, { conversationId });
    }
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    try {
      const { data: project, error } = await this.supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to update project: ${error.message}`, { id, updates });
      return project;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error updating project: ${error.message}`, { id, updates });
    }
  }

  async updateProjectStatus(id: number, status: ProjectStatus, errorMessage?: string): Promise<Project> {
    const updates: Partial<Project> = { status };
    
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    return this.updateProject(id, updates);
  }

  async getActiveProjects(): Promise<Project[]> {
    try {
      const { data: projects, error } = await this.supabase
        .from('projects')
        .select('*')
        .not('status', 'in', '(completed,failed,cancelled)')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw new DatabaseError(`Failed to get active projects: ${error.message}`);
      return projects || [];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting active projects: ${error.message}`);
    }
  }
}

// Build event operations
export class BuildEventService {
  constructor(private supabase: SupabaseClient) {}

  async createBuildEvent(data: Partial<BuildEvent>): Promise<BuildEvent> {
    try {
      const { data: event, error } = await this.supabase
        .from('build_events')
        .insert([data])
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to create build event: ${error.message}`, { data });
      return event;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error creating build event: ${error.message}`, { data });
    }
  }

  async getBuildEvents(projectId: number, limit = 100): Promise<BuildEvent[]> {
    try {
      const { data: events, error } = await this.supabase
        .from('build_events')
        .select('*')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw new DatabaseError(`Failed to get build events: ${error.message}`, { projectId });
      return events || [];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting build events: ${error.message}`, { projectId });
    }
  }

  async getLatestBuildEvent(projectId: number, eventType?: BuildEventType): Promise<BuildEvent | null> {
    try {
      let query = this.supabase
        .from('build_events')
        .select('*')
        .eq('project_id', projectId);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data: event, error } = await query
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to get latest build event: ${error.message}`, { projectId, eventType });
      }
      
      return event;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting latest build event: ${error.message}`, { projectId, eventType });
    }
  }
}

// Queue operations
export class QueueService {
  constructor(private supabase: SupabaseClient) {}

  async queueTask(taskType: TaskType, taskData: Record<string, any>, priority = 1): Promise<QueueTask> {
    try {
      const { data: task, error } = await this.supabase
        .from('processing_queue')
        .insert([{
          task_type: taskType,
          task_data: taskData,
          priority,
          status: 'pending' as TaskStatus
        }])
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to queue task: ${error.message}`, { taskType, taskData });
      return task;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error queueing task: ${error.message}`, { taskType, taskData });
    }
  }

  async getPendingTasks(limit = 10): Promise<QueueTask[]> {
    try {
      const { data: tasks, error } = await this.supabase
        .from('processing_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw new DatabaseError(`Failed to get pending tasks: ${error.message}`);
      return tasks || [];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting pending tasks: ${error.message}`);
    }
  }

  async updateTaskStatus(id: number, status: TaskStatus, errorMessage?: string): Promise<QueueTask> {
    try {
      const updates: Partial<QueueTask> = { status };
      
      if (status === 'processing') {
        updates.started_at = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updates.completed_at = new Date().toISOString();
      }
      
      if (errorMessage) {
        updates.error_message = errorMessage;
      }

      const { data: task, error } = await this.supabase
        .from('processing_queue')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to update task status: ${error.message}`, { id, status });
      return task;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error updating task status: ${error.message}`, { id, status });
    }
  }

  async incrementTaskRetry(id: number): Promise<QueueTask> {
    try {
      const { data: task, error } = await this.supabase
        .from('processing_queue')
        .update({ 
          retry_count: this.supabase.rpc('increment_retry_count', { task_id: id }),
          status: 'pending' as TaskStatus
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new DatabaseError(`Failed to increment task retry: ${error.message}`, { id });
      return task;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error incrementing task retry: ${error.message}`, { id });
    }
  }
}

// API usage tracking
export class APIUsageService {
  constructor(private supabase: SupabaseClient) {}

  async trackAPIUsage(data: Partial<APIUsage>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_usage')
        .insert([data]);

      if (error) throw new DatabaseError(`Failed to track API usage: ${error.message}`, { data });
    } catch (error) {
      // Don't throw for API usage tracking failures - just log
      console.error('API usage tracking failed:', error);
    }
  }

  async getAPIUsageStats(apiName: string, hours = 24): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('api_usage')
        .select('*')
        .eq('api_name', apiName)
        .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

      if (error) throw new DatabaseError(`Failed to get API usage stats: ${error.message}`, { apiName, hours });
      
      return {
        total_requests: data?.length || 0,
        avg_response_time: data?.reduce((sum, item) => sum + (item.response_time_ms || 0), 0) / (data?.length || 1),
        error_rate: data?.filter(item => item.status_code >= 400).length / (data?.length || 1)
      };
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting API usage stats: ${error.message}`, { apiName, hours });
    }
  }
}

// System configuration
export class ConfigService {
  constructor(private supabase: SupabaseClient) {}

  async getConfig(key: string): Promise<any> {
    try {
      const { data: config, error } = await this.supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', key)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new DatabaseError(`Failed to get config: ${error.message}`, { key });
      }
      
      return config?.config_value;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error getting config: ${error.message}`, { key });
    }
  }

  async setConfig(key: string, value: any, description?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('system_config')
        .upsert([{
          config_key: key,
          config_value: value,
          description,
          is_active: true
        }]);

      if (error) throw new DatabaseError(`Failed to set config: ${error.message}`, { key, value });
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Unexpected error setting config: ${error.message}`, { key, value });
    }
  }
}

// Database service factory
export class DatabaseService {
  public projects: ProjectService;
  public buildEvents: BuildEventService;
  public queue: QueueService;
  public apiUsage: APIUsageService;
  public config: ConfigService;

  constructor(private supabase: SupabaseClient) {
    this.projects = new ProjectService(supabase);
    this.buildEvents = new BuildEventService(supabase);
    this.queue = new QueueService(supabase);
    this.apiUsage = new APIUsageService(supabase);
    this.config = new ConfigService(supabase);
  }

  static create(): DatabaseService {
    const supabase = createSupabaseClient();
    return new DatabaseService(supabase);
  }
}