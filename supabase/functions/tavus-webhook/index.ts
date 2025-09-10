import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { event_type, conversation_id, data } = await req.json()
    
    console.log('Tavus webhook received:', {
      event_type,
      conversation_id,
      timestamp: new Date().toISOString(),
    })

    // Store webhook event in Supabase
    try {
      const { error: dbError } = await supabaseClient
        .from('conversation_events')
        .insert([
          {
            conversation_id,
            event_type,
            event_data: data || {},
            received_at: new Date().toISOString()
          }
        ])

      if (dbError) {
        console.error('Error storing webhook event:', dbError)
      }
    } catch (dbError) {
      console.error('Database error storing webhook:', dbError)
    }

    // Update conversation status based on event
    try {
      let updateData: any = {}
      
      switch (event_type) {
        case 'conversation_started':
          console.log('Conversation started:', conversation_id)
          updateData = { 
            status: 'active',
            started_at: new Date().toISOString()
          }
          break
        case 'conversation_ended':
          console.log('Conversation ended:', conversation_id)
          updateData = { 
            status: 'completed',
            ended_at: new Date().toISOString()
          }
          break
        case 'participant_joined':
          console.log('Participant joined:', conversation_id)
          updateData = { 
            participant_joined_at: new Date().toISOString()
          }
          break
        case 'participant_left':
          console.log('Participant left:', conversation_id)
          updateData = { 
            participant_left_at: new Date().toISOString()
          }
          break
        default:
          console.log('Unknown event type:', event_type)
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseClient
          .from('conversations')
          .update(updateData)
          .eq('conversation_id', conversation_id)

        if (updateError) {
          console.error('Error updating conversation:', updateError)
        }
      }
    } catch (updateError) {
      console.error('Error updating conversation status:', updateError)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})