const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Tavus API endpoint - Create Conversation
app.post('/api/tavus/create-conversation', async (req, res) => {
  try {
    const { replica_id, conversation_name } = req.body;
    
    // Prepare request body according to Tavus API docs
    const requestBody = {
      replica_id: replica_id || process.env.TAVUS_DEFAULT_REPLICA_ID,
      persona_id: process.env.TAVUS_DEFAULT_PERSONA_ID,
      conversation_name: conversation_name || `Tech Co-Founder Session ${Date.now()}`,
      callback_url: process.env.TAVUS_CALLBACK_URL,
      properties: {
        max_call_duration: 1800, // 30 minutes
        participant_left_timeout: 60,
        participant_absent_timeout: 300,
        enable_recording: false,
        enable_transcription: true,
      }
    };

    console.log('Creating Tavus conversation with:', {
      replica_id: requestBody.replica_id,
      persona_id: requestBody.persona_id,
      conversation_name: requestBody.conversation_name
    });
    
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await tavusResponse.text();
    
    if (!tavusResponse.ok) {
      console.error('Tavus API Error:', {
        status: tavusResponse.status,
        statusText: tavusResponse.statusText,
        response: responseText
      });
      
      let errorMessage = 'Failed to create conversation with Tavus API';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      
      return res.status(tavusResponse.status).json({
        error: errorMessage,
        status: tavusResponse.status
      });
    }

    let conversationData;
    try {
      conversationData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Tavus response:', responseText);
      return res.status(500).json({
        error: 'Invalid response from Tavus API'
      });
    }
    
    // Store conversation in Supabase
    try {
      const { error: dbError } = await supabase
        .from('conversations')
        .insert([
          {
            conversation_id: conversationData.conversation_id,
            conversation_url: conversationData.conversation_url,
            conversation_name: requestBody.conversation_name,
            replica_id: requestBody.replica_id,
            persona_id: requestBody.persona_id,
            status: conversationData.status,
            created_at: new Date().toISOString(),
            tavus_created_at: conversationData.created_at
          }
        ]);

      if (dbError) {
        console.error('Error storing conversation in database:', dbError);
        // Continue anyway - don't fail the request if DB storage fails
      } else {
        console.log('Conversation stored in database successfully');
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue anyway - don't fail the request if DB storage fails
    }

    // Log conversation creation for analytics
    console.log('Conversation created successfully:', {
      conversation_id: conversationData.conversation_id,
      status: conversationData.status,
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

// Tavus API endpoint - Get Conversation
app.get('/api/tavus/conversation/:conversation_id', async (req, res) => {
  try {
    const { conversation_id } = req.params;
    
    console.log('Fetching conversation:', conversation_id);
    
    const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}`, {
      method: 'GET',
      headers: {
        'x-api-key': process.env.TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await tavusResponse.text();
    
    if (!tavusResponse.ok) {
      console.error('Tavus API Error:', {
        status: tavusResponse.status,
        statusText: tavusResponse.statusText,
        response: responseText
      });
      
      let errorMessage = 'Failed to fetch conversation from Tavus API';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      
      return res.status(tavusResponse.status).json({
        error: errorMessage,
        status: tavusResponse.status
      });
    }

    let conversationData;
    try {
      conversationData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Tavus response:', responseText);
      return res.status(500).json({
        error: 'Invalid response from Tavus API'
      });
    }
    
    console.log('Conversation fetched successfully:', {
      conversation_id: conversationData.conversation_id,
      status: conversationData.status,
    });

    res.json(conversationData);

  } catch (error) {
    console.error('Error fetching Tavus conversation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/create-user-session', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const token = `temp_token_${Date.now()}`;

    const { data, error } = await supabase
      .from('user_sessions')
      .insert([{ user_id, token, active: true }]);

    if (error) {
      throw error;
    }

    res.json({ user_id, token });

  } catch (error) {
    console.error('Error creating user session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/tavus/end-conversation', async (req, res) => {
  try {
    const { conversation_id } = req.body;

    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    console.log('Ending Tavus conversation:', conversation_id);

    const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/end`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await tavusResponse.text();

    if (!tavusResponse.ok) {
      console.error('Tavus API Error:', {
        status: tavusResponse.status,
        statusText: tavusResponse.statusText,
        response: responseText
      });

      let errorMessage = 'Failed to end conversation with Tavus API';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }

      return res.status(tavusResponse.status).json({
        error: errorMessage,
        status: tavusResponse.status
      });
    }

    res.json({ success: true, message: 'Conversation ended successfully' });

  } catch (error) {
    console.error('Error ending Tavus conversation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get conversations endpoint
app.get('/api/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }

    res.json({ conversations: data });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation events endpoint
app.get('/api/conversations/:conversation_id/events', async (req, res) => {
  try {
    const { conversation_id } = req.params;
    
    const { data, error } = await supabase
      .from('conversation_events')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('received_at', { ascending: true });

    if (error) {
      console.error('Error fetching conversation events:', error);
      return res.status(500).json({ error: 'Failed to fetch conversation events' });
    }

    res.json({ events: data });
  } catch (error) {
    console.error('Error fetching conversation events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks endpoint
app.get('/api/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    res.json({ tasks: data });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Tavus webhook endpoint for conversation events
app.post('/api/summarize', async (req, res) => {
  try {
    const { conversation_id } = req.body;

    const { data, error } = await supabase.functions.invoke('summarize-conversation', {
      body: { conversation_id },
    });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    res.status(500).json({ error: 'Failed to summarize conversation' });
  }
});

app.post('/api/tavus/webhook', async (req, res) => {
  try {
    const { event_type, conversation_id, data } = req.body;
    
    console.log('--- NEW TAVUS WEBHOOK RECEIVED ---');
    console.log('Event Type:', event_type);
    console.log('Conversation ID:', conversation_id);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Full Request Body:', JSON.stringify(req.body, null, 2));
    console.log('------------------------------------');

    // Store webhook event in Supabase
    try {
      const { error: dbError } = await supabase
        .from('conversation_events')
        .insert([
          {
            conversation_id,
            event_type,
            event_data: data || {},
            received_at: new Date().toISOString()
          }
        ]);

      if (dbError) {
        console.error('Error storing webhook event:', dbError);
      }
    } catch (dbError) {
      console.error('Database error storing webhook:', dbError);
    }

    // Update conversation status based on event
    try {
      let updateData = {};
      
      switch (event_type) {
        case 'conversation_started':
          console.log('Conversation started:', conversation_id);
          updateData = { 
            status: 'active',
            started_at: new Date().toISOString()
          };
          break;
        case 'system.shutdown':
          console.log('System shutdown:', conversation_id);
          updateData = { 
            status: 'completed',
            ended_at: new Date().toISOString()
          };
          // Trigger summarization
          console.log('Triggering summarization for:', conversation_id);
          supabase.functions.invoke('summarize-conversation', {
            body: { conversation_id },
          }).then(res => {
            if (res.error) {
              console.error('Error invoking summarize-conversation function:', res.error);
            } else {
              console.log('Summarization function invoked successfully:', res.data);
            }
          });
          break;
        case 'participant_joined':
          console.log('Participant joined:', conversation_id);
          updateData = { 
            participant_joined_at: new Date().toISOString()
          };
          break;
        case 'participant_left':
          console.log('Participant left:', conversation_id);
          updateData = { 
            participant_left_at: new Date().toISOString()
          };
          break;
        case 'system.replica_joined':
          console.log('Replica joined:', conversation_id);
          break;
        case 'application.transcription_ready':
          console.log('Transcription ready:', conversation_id);
          // Store the transcript in the conversation_events table
          try {
            const { error: dbError } = await supabase
              .from('conversation_events')
              .insert([
                {
                  conversation_id,
                  event_type: 'transcription_updated',
                  event_data: { transcript: data.transcript },
                  received_at: new Date().toISOString()
                }
              ]);

            if (dbError) {
              console.error('Error storing transcript:', dbError);
            }
          } catch (dbError) {
            console.error('Database error storing transcript:', dbError);
          }
          break;
        default:
          console.log('Unknown event type:', event_type);
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update(updateData)
          .eq('conversation_id', conversation_id);

        if (updateError) {
          console.error('Error updating conversation:', updateError);
        }
      }
    } catch (updateError) {
      console.error('Error updating conversation status:', updateError);
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
