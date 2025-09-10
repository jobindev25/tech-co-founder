const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Create tables automatically
async function createTables() {
  try {
    console.log('🚀 Creating Supabase tables...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables');
      console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    console.log('📋 Creating conversations table...');
    
    // Create conversations table
    const { error: conversationsError } = await supabase.rpc('exec_sql', {
      sql: `
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
          participant_left_at TIMESTAMPTZ
        );
      `
    });

    if (conversationsError) {
      console.error('❌ Error creating conversations table:', conversationsError);
      console.log('💡 You need to create the tables manually in Supabase SQL Editor');
      console.log('📝 Copy the SQL from backend/supabase-schema.sql');
      return;
    }

    console.log('✅ Conversations table created successfully!');

    console.log('📋 Creating conversation_events table...');
    
    // Create conversation_events table
    const { error: eventsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS conversation_events (
          id BIGSERIAL PRIMARY KEY,
          conversation_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB DEFAULT '{}',
          received_at TIMESTAMPTZ DEFAULT NOW(),
          FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
        );
      `
    });

    if (eventsError) {
      console.error('❌ Error creating conversation_events table:', eventsError);
      return;
    }

    console.log('✅ Conversation_events table created successfully!');

    // Test the tables
    console.log('🧪 Testing table access...');
    const { data, error } = await supabase
      .from('conversations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Table test failed:', error.message);
      console.log('💡 Manual setup required - see instructions below');
    } else {
      console.log('✅ All tables created and accessible!');
      console.log('🎉 Supabase database is ready for conversations!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Manual Setup Instructions:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the SQL from backend/supabase-schema.sql');
    console.log('5. Click "Run" to execute the SQL');
  }
}

createTables();