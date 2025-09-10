import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversation_id } = await req.json();

    if (!conversation_id) {
      throw new Error('Missing conversation_id in request body');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Fetch conversation events
    const { data: events, error: eventsError } = await supabase
      .from('conversation_events')
      .select('event_data')
      .eq('conversation_id', conversation_id)
      .eq('event_type', 'transcription_updated');

    if (eventsError) throw eventsError;

    // 2. Combine the transcript
    const transcript = events
      .map(event => event.event_data?.transcript || '')
      .join(' ');

    if (!transcript.trim()) {
      return new Response(JSON.stringify({ summary: 'No transcript available to summarize.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Call Gemini API for summarization
    const prompt = `Please provide a concise summary of the following conversation transcript:\n\nTranscript:\n${transcript}\n\nSummary:`;

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      throw new Error(`Gemini API request failed with status ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const summary = geminiData.candidates[0]?.content?.parts[0]?.text || 'Could not generate summary.';

    // 4. Store the summary in the conversations table
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ summary })
      .eq('conversation_id', conversation_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
