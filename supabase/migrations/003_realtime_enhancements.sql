-- Enhanced real-time and broadcasting tables
-- Migration: 003_realtime_enhancements.sql

-- Real-time events table for client subscriptions
CREATE TABLE IF NOT EXISTS realtime_events (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  message TEXT,
  channel VARCHAR(100) DEFAULT 'project_updates' CHECK (channel IN (
    'project_updates', 'build_events', 'user_notifications', 'system_alerts'
  )),
  user_id VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false
);

-- Broadcast events table for audit trail
CREATE TABLE IF NOT EXISTS broadcast_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  channel VARCHAR(100) DEFAULT 'project_updates' CHECK (channel IN (
    'project_updates', 'build_events', 'user_notifications', 'system_alerts'
  )),
  message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  recipients_count INTEGER DEFAULT 0
);

-- User notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- User sessions table for WebSocket authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token VARCHAR(500) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- WebSocket connections tracking (optional, for monitoring)
CREATE TABLE IF NOT EXISTS websocket_connections (
  id BIGSERIAL PRIMARY KEY,
  connection_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_ping_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_realtime_events_project_id ON realtime_events(project_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_timestamp ON realtime_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_realtime_events_channel ON realtime_events(channel);
CREATE INDEX IF NOT EXISTS idx_realtime_events_processed ON realtime_events(processed, timestamp);

CREATE INDEX IF NOT EXISTS idx_broadcast_events_project_id ON broadcast_events(project_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_events_timestamp ON broadcast_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_broadcast_events_channel ON broadcast_events(channel);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_project_id ON user_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(read, created_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active, expires_at);

CREATE INDEX IF NOT EXISTS idx_websocket_connections_user_id ON websocket_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_project_id ON websocket_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_active ON websocket_connections(disconnected_at) WHERE disconnected_at IS NULL;

-- Add last_activity_at to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_projects_last_activity ON projects(last_activity_at);

-- Row Level Security
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to realtime_events" ON realtime_events
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to realtime_events" ON realtime_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role full access to broadcast_events" ON broadcast_events
  FOR ALL USING (true);

CREATE POLICY "Users can read their own notifications" ON user_notifications
  FOR SELECT USING (true); -- Adjust based on your auth system

CREATE POLICY "Allow service role full access to user_notifications" ON user_notifications
  FOR ALL USING (true);

CREATE POLICY "Users can manage their own sessions" ON user_sessions
  FOR ALL USING (true); -- Adjust based on your auth system

CREATE POLICY "Allow service role full access to websocket_connections" ON websocket_connections
  FOR ALL USING (true);

-- Cleanup function for old records
CREATE OR REPLACE FUNCTION cleanup_old_realtime_events()
RETURNS void AS $$
BEGIN
  -- Delete processed realtime events older than 24 hours
  DELETE FROM realtime_events 
  WHERE processed = true 
    AND timestamp < NOW() - INTERVAL '24 hours';
    
  -- Delete old broadcast events older than 7 days
  DELETE FROM broadcast_events 
  WHERE timestamp < NOW() - INTERVAL '7 days';
    
  -- Delete old websocket connections older than 1 day
  DELETE FROM websocket_connections 
  WHERE disconnected_at IS NOT NULL 
    AND disconnected_at < NOW() - INTERVAL '1 day';
    
  -- Delete expired user sessions
  DELETE FROM user_sessions 
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-realtime-data', '0 2 * * *', 'SELECT cleanup_old_realtime_events();');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Insert default configuration for real-time features
INSERT INTO system_config (config_key, config_value, description) VALUES
('realtime_enabled', 'true', 'Enable/disable real-time event broadcasting'),
('websocket_max_connections', '1000', 'Maximum number of concurrent WebSocket connections'),
('notification_retention_days', '30', 'Number of days to retain user notifications'),
('realtime_event_retention_hours', '24', 'Number of hours to retain processed realtime events'),
('broadcast_event_retention_days', '7', 'Number of days to retain broadcast events'),
('max_build_retries', '3', 'Maximum number of build retry attempts')
ON CONFLICT (config_key) DO NOTHING;