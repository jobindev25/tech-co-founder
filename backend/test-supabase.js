const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables');
      console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test basic connection by checking auth
    console.log('Testing basic Supabase connection...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError && authError.message !== 'Auth session missing!') {
      console.error('❌ Supabase connection failed:', authError.message);
      return;
    }

    console.log('✅ Basic Supabase connection successful!');
    
    // Test connection by trying to select from conversations table
    console.log('Testing conversations table...');
    const { data, error } = await supabase
      .from('conversations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      console.log('Make sure you have run the SQL schema in your Supabase project');
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Database is ready to store conversations');
    }
  } catch (error) {
    console.error('❌ Error testing Supabase:', error.message);
  }
}

testSupabaseConnection();