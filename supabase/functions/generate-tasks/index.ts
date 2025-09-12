import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { summary } = await req.json();

    if (!summary) {
      throw new Error('Missing summary in request body');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Call Gemini API to generate tasks
    const prompt = `Based on the following summary, please generate a list of actionable tasks:\n\nSummary:\n${summary}\n\nTasks:`;

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
    const tasks = geminiData.candidates[0]?.content?.parts[0]?.text || 'Could not generate tasks.';

    // 2. Store the tasks in a new table
    const { data: taskData, error: insertError } = await supabase
      .from('tasks')
      .insert([{ tasks }])
      .select();

    if (insertError) throw insertError;

    // 3. Trigger Kiro build
    await supabase.functions.invoke('trigger-kiro-build', {
      body: {
        project_id: taskData[0].id,
        project_plan: {
          name: 'New Project',
          description: 'This is a new project',
          techStack: {
            frontend: 'React',
            backend: 'Node.js',
            database: 'Supabase',
          },
          features: [
            {
              name: 'New Feature',
              description: 'This is a new feature',
              priority: 'high',
            },
          ],
          architecture: {
            type: 'microservices',
          },
          timeline: {
            estimated_hours: 100,
          },
          fileStructure: [],
          dependencies: [],
          kiroConfig: {},
        },
      },
    });

    return new Response(JSON.stringify({ tasks }), {
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
