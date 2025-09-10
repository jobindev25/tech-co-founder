-- Simple table creation for conversations
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) UNIQUE NOT NULL,
  conversation_url TEXT,
  conversation_name VARCHAR(255),
  replica_id VARCHAR(255),
  persona_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tavus_created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  participant_joined_at TIMESTAMPTZ,
  participant_left_at TIMESTAMPTZ
);

-- Simple table creation for conversation events
CREATE TABLE conversation_events (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
CREATE INDEX idx_conversation_events_conversation_id ON conversation_events(conversation_id);

-- Enable RLS (Row Level Security)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

-- Create simple policies to allow all operations
CREATE POLICY "Enable all operations for conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for conversation_events" ON conversation_events FOR ALL USING (true) WITH CHECK (true);