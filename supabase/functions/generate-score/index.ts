import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskAssignmentId } = await req.json();
    
    if (!taskAssignmentId) {
      throw new Error('taskAssignmentId is required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch task assignment with task and work logs
    const { data: assignment, error: assignmentError } = await supabase
      .from('task_assignments')
      .select('id, status, task_id')
      .eq('id', taskAssignmentId)
      .single();

    if (assignmentError || !assignment) {
      throw new Error('Task assignment not found');
    }

    // Fetch task separately
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, description_text, estimated_slots')
      .eq('id', assignment.task_id)
      .single();

    // Fetch work logs
    const { data: workLogs } = await supabase
      .from('work_logs')
      .select('id, note_text, timestamp')
      .eq('task_assignment_id', taskAssignmentId);

    const logs = workLogs || [];
    const workLogSummary = logs
      .map((log: any, i: number) => `Update ${i + 1}: ${log.note_text || 'No notes'}`)
      .join('\n');

    const prompt = `You are an AI work performance evaluator.

TASK:
Title: ${task?.title || 'Unknown'}
Description: ${task?.description_text || 'No description'}
Estimated Effort: ${task?.estimated_slots || 1} slot(s)

PROGRESS UPDATES (${logs.length} total):
${workLogSummary || 'No updates'}

Provide a score 0-10 and brief summary. Return JSON:
{"summary": "Brief summary", "score": 7, "reasoning": "Brief reasoning"}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are an AI work evaluator. Respond with valid JSON only." }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let score = 5;
    let summary = 'Unable to generate summary';
    let reasoning = '';

    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Math.min(10, Math.max(0, parseInt(parsed.score) || 5));
        summary = parsed.summary || summary;
        reasoning = parsed.reasoning || '';
      }
    } catch (e) {
      console.error("Error parsing AI response:", e);
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: existingScore } = await supabase
      .from('daily_scores')
      .select('id')
      .eq('task_assignment_id', taskAssignmentId)
      .eq('date', today)
      .single();

    if (existingScore) {
      await supabase
        .from('daily_scores')
        .update({ auto_score: score, summary_text: summary, ai_analysis: reasoning })
        .eq('id', existingScore.id);
    } else {
      await supabase
        .from('daily_scores')
        .insert({ task_assignment_id: taskAssignmentId, date: today, auto_score: score, summary_text: summary, ai_analysis: reasoning });
    }

    return new Response(JSON.stringify({ success: true, score, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
