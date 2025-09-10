const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Supabase database...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables');
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Create conversations table
    console.log('📝 Creating conversations table...');
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
    } else {
      console.log('✅ Conversations table created successfully');
    }

    // Create conversation_events table
    console.log('📝 Creating conversation_events table...');
    const { error: eventsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS conversation_events (
          id BIGSERIAL PRIMARY KEY,
          conversation_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB DEFAULT '{}',
          received_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (eventsError) {
      console.error('❌ Error creating conversation_events table:', eventsError);
    } else {
      console.log('✅ Conversation_events table created successfully');
    }

    // Test the tables
    console.log('🧪 Testing table access...');
    const { data, error } = await supabase
      .from('conversations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing conversations table:', error);
      console.log('\n📋 Manual Setup Required:');
      console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the SQL from backend/create-tables.sql');
      console.log('4. Click "Run" to execute the SQL');
    } else {
      console.log('✅ Database setup complete! Tables are ready to use.');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Manual Setup Required:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL from backend/create-tables.sql');
    console.log('4. Click "Run" to execute the SQL');
  }
}

setupDatabase();