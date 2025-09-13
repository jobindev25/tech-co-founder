import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Logger } from '../_shared/utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logger = new Logger('CreateConversation')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { replica_id, conversation_name } = await req.json()

    // Prepare request body for Tavus API
    const requestBody = {
      replica_id: replica_id || Deno.env.get('TAVUS_DEFAULT_REPLICA_ID'),
      persona_id: Deno.env.get('TAVUS_DEFAULT_PERSONA_ID'),
      conversation_name: conversation_name || `Tech Co-Founder Session ${Date.now()}`,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/tavus-webhook`,
      properties: {
        max_call_duration: 1800, // 30 minutes
        participant_left_timeout: 60,
        participant_absent_timeout: 300,
        enable_recording: false,
        enable_transcription: true,
      }
    }

    logger.info('Creating Tavus conversation with:', {
      replica_id: requestBody.replica_id,
      persona_id: requestBody.persona_id,
      conversation_name: requestBody.conversation_name
    })

    // Call Tavus API
    const tavusResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('TAVUS_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await tavusResponse.text()

    if (!tavusResponse.ok) {
      logger.error('Tavus API Error:', {
        status: tavusResponse.status,
        statusText: tavusResponse.statusText,
        response: responseText
      })
      
      let errorMessage = 'Failed to create conversation with Tavus API'
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        errorMessage = responseText || errorMessage
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, status: tavusResponse.status }),
        { 
          status: tavusResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let conversationData
    try {
      conversationData = JSON.parse(responseText)
    } catch (e) {
      logger.error('Failed to parse Tavus response:', { responseText, error: e.message })
      return new Response(
        JSON.stringify({ error: 'Invalid response from Tavus API' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Store conversation in Supabase
    try {
      const { error: dbError } = await supabaseClient
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
        ])

      if (dbError) {
        logger.error('Error storing conversation in database:', dbError)
        // Continue anyway - don't fail the request if DB storage fails
      } else {
        logger.info('Conversation stored in database successfully')
      }
    } catch (dbError) {
      logger.error('Database error:', dbError)
      // Continue anyway - don't fail the request if DB storage fails
    }

    // Log conversation creation for analytics
    logger.info('Conversation created successfully:', {
      conversation_id: conversationData.conversation_id,
      status: conversationData.status,
      timestamp: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        conversation_id: conversationData.conversation_id,
        conversation_url: conversationData.conversation_url,
        status: conversationData.status,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    logger.error('Error creating Tavus conversation:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
