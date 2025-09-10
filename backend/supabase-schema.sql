-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
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
  participant_left_at TIMESTAMPTZ,
  summary TEXT
);

-- Create conversation_events table
CREATE TABLE IF NOT EXISTS conversation_events (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation_id ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_received_at ON conversation_events(received_at);

-- Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access to conversations" ON conversations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to conversations" ON conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to conversations" ON conversations
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to conversation_events" ON conversation_events
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to conversation_events" ON conversation_events
  FOR INSERT WITH CHECK (true);
