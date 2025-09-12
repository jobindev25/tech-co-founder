// Test Tavus API integration - using credentials from .env file
require('dotenv').config({ path: 'backend/.env' });

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const REPLICA_ID = process.env.TAVUS_DEFAULT_REPLICA_ID;
const PERSONA_ID = process.env.TAVUS_DEFAULT_PERSONA_ID;

async function testTavusAPI() {
  console.log('Testing Tavus API integration...');
  
  // Use exact same format as curl example
  const requestBody = {
    replica_id: REPLICA_ID,
    persona_id: PERSONA_ID
  };

  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Success! Conversation created:');
      console.log('- Conversation ID:', data.conversation_id);
      console.log('- Conversation URL:', data.conversation_url);
      console.log('- Status:', data.status);
      return data;
    } else {
      console.log('❌ Error:', response.status, response.statusText);
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Raw error response:', responseText);
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return null;
  }
}

// Run the test
testTavusAPI();
