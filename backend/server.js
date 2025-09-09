const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Tavus API endpoint
app.post('/api/tavus/create-conversation', async (req, res) => {
  try {
    const { persona_id } = req.body;
    
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        replica_id: persona_id || process.env.TAVUS_DEFAULT_PERSONA_ID,
        conversation_name: `Tech Co-Founder Session ${Date.now()}`,
        callback_url: process.env.TAVUS_CALLBACK_URL,
        properties: {
          max_call_duration: 1800, // 30 minutes
          participant_left_timeout: 60,
          participant_absent_timeout: 300,
          enable_recording: false,
          enable_transcription: true,
        }
      }),
    });

    if (!tavusResponse.ok) {
      const errorData = await tavusResponse.text();
      console.error('Tavus API Error:', errorData);
      return res.status(tavusResponse.status).json({
        error: 'Failed to create conversation with Tavus API',
        details: errorData
      });
    }

    const conversationData = await tavusResponse.json();
    
    // Log conversation creation for analytics
    console.log('Conversation created:', {
      conversation_id: conversationData.conversation_id,
      timestamp: new Date().toISOString(),
    });

    res.json({
      conversation_id: conversationData.conversation_id,
      conversation_url: conversationData.conversation_url,
      status: conversationData.status,
    });

  } catch (error) {
    console.error('Error creating Tavus conversation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Tavus webhook endpoint for conversation events
app.post('/api/tavus/webhook', (req, res) => {
  try {
    const { event_type, conversation_id, data } = req.body;
    
    console.log('Tavus webhook received:', {
      event_type,
      conversation_id,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event_type) {
      case 'conversation_started':
        console.log('Conversation started:', conversation_id);
        break;
      case 'conversation_ended':
        console.log('Conversation ended:', conversation_id);
        // Here you could save conversation data, send follow-up emails, etc.
        break;
      case 'participant_joined':
        console.log('Participant joined:', conversation_id);
        break;
      case 'participant_left':
        console.log('Participant left:', conversation_id);
        break;
      default:
        console.log('Unknown event type:', event_type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});