-- Enhanced database schema for automated development pipeline
-- Migration: 002_pipeline_schema.sql

-- Projects table for managing development projects
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
  project_name VARCHAR(255) NOT NULL,
  project_description TEXT,
  conversation_summary TEXT,
  project_plan JSONB,
  kiro_build_id VARCHAR(255),
  kiro_project_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'analyzing' CHECK (status IN (
    'analyzing', 'planning', 'ready_to_build', 'building', 
    'completed', 'failed', 'cancelled'
  )),
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  -- Constraints
  CONSTRAINT unique_conversation_project UNIQUE(conversation_id),
  CONSTRAINT valid_kiro_ids CHECK (
    (kiro_build_id IS NULL AND kiro_project_id IS NULL) OR 
    (kiro_build_id IS NOT NULL AND kiro_project_id IS NOT NULL)
  )
);

-- Build events for tracking Kiro build progress
CREATE TABLE IF NOT EXISTS build_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kiro_build_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
    'build_started', 'build_progress', 'build_completed', 
    'build_failed', 'build_cancelled', 'log_entry', 'file_generated'
  )),
  event_data JSONB DEFAULT '{}',
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  sequence_number INTEGER,
  
  -- Constraints
  CONSTRAINT valid_sequence CHECK (sequence_number >= 0)
);

-- Processing queue for managing pipeline tasks
CREATE TABLE IF NOT EXISTS processing_queue (
  id BIGSERIAL PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL CHECK (task_type IN (
    'analyze_conversation', 'generate_plan', 'trigger_build', 
    'process_webhook', 'send_notification'
  )),
  task_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Constraints
  CONSTRAINT valid_retry_count CHECK (retry_count <= max_retries)
);

-- API rate limiting and usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL CHECK (api_name IN (
    'tavus', 'openai', 'claude', 'kiro'
  )),
  endpoint VARCHAR(255),
  request_count INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id VARCHAR(255),
  project_id BIGINT REFERENCES projects(id),
  
  -- Constraints
  CONSTRAINT valid_response_time CHECK (response_time_ms >= 0),
  CONSTRAINT valid_status_code CHECK (status_code BETWEEN 100 AND 599)
);

-- System configuration and feature flags
CREATE TABLE IF NOT EXISTS system_config (
  id BIGSERIAL PRIMARY KEY,
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_projects_conversation_id ON projects(conversation_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_kiro_build_id ON projects(kiro_build_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status_priority ON projects(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_build_events_project_id ON build_events(project_id);
CREATE INDEX IF NOT EXISTS idx_build_events_timestamp ON build_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_build_events_kiro_build_id ON build_events(kiro_build_id);
CREATE INDEX IF NOT EXISTS idx_build_events_type_timestamp ON build_events(event_type, timestamp);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_processing_queue_task_type ON processing_queue(task_type);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status_priority ON processing_queue(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_name ON api_usage(api_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_project_id ON api_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_date ON api_usage(api_name, DATE(created_at));

-- Triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at 
  BEFORE UPDATE ON system_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your authentication system)
CREATE POLICY "Allow public read access to projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to projects" ON projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to projects" ON projects
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to build_events" ON build_events
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to build_events" ON build_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role full access to processing_queue" ON processing_queue
  FOR ALL USING (true);

CREATE POLICY "Allow service role full access to api_usage" ON api_usage
  FOR ALL USING (true);

CREATE POLICY "Allow public read access to system_config" ON system_config
  FOR SELECT USING (is_active = true);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('pipeline_enabled', 'true', 'Enable/disable the automated development pipeline'),
('max_concurrent_builds', '5', 'Maximum number of concurrent Kiro builds'),
('ai_analysis_timeout', '300', 'Timeout in seconds for AI conversation analysis'),
('kiro_api_timeout', '60', 'Timeout in seconds for Kiro API calls'),
('retry_delays', '[1000, 2000, 5000, 10000]', 'Retry delays in milliseconds'),
('webhook_signature_validation', 'true', 'Enable webhook signature validation')
ON CONFLICT (config_key) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW active_projects AS
SELECT 
  p.*,
  c.conversation_name,
  c.created_at as conversation_created_at,
  COUNT(be.id) as event_count,
  MAX(be.timestamp) as last_event_at
FROM projects p
LEFT JOIN conversations c ON p.conversation_id = c.conversation_id
LEFT JOIN build_events be ON p.id = be.project_id
WHERE p.status NOT IN ('completed', 'failed', 'cancelled')
GROUP BY p.id, c.conversation_name, c.created_at;

CREATE OR REPLACE VIEW project_summary AS
SELECT 
  p.id,
  p.project_name,
  p.status,
  p.created_at,
  p.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(p.completed_at, NOW()) - p.created_at)) / 60 as duration_minutes,
  COUNT(be.id) as total_events,
  COUNT(CASE WHEN be.event_type = 'build_progress' THEN 1 END) as progress_events,
  MAX(CASE WHEN be.event_type = 'build_progress' THEN (be.event_data->>'progress')::integer END) as latest_progress
FROM projects p
LEFT JOIN build_events be ON p.id = be.project_id
GROUP BY p.id, p.project_name, p.status, p.created_at, p.completed_at;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;