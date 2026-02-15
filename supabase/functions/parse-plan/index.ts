import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedPlan {
  title: string;
  estimatedSlots: number;
  subtasks: string[];
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, language = 'hi' } = await req.json();
    
    if (!transcription) {
      return new Response(
        JSON.stringify({ error: 'No transcription provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Parsing plan from transcription:', transcription.substring(0, 100));

    const systemPrompt = `You are a task parser for field workers in India. Given a voice transcription of someone's daily work plan, extract:
1. A clear, concise title (max 50 chars) summarizing the main work
2. Estimated time slots (each slot = 2 hours, so 1 slot = 2h, 2 slots = 4h, 3 slots = 6h, 4 slots = 8h full day)
3. List of specific subtasks mentioned
4. Confidence score (0-1) of how well you understood the plan

Common work types and typical durations:
- Construction/repair work: 3-4 slots (6-8 hours)
- Delivery runs: 2-3 slots (4-6 hours)  
- Cleaning/maintenance: 2 slots (4 hours)
- Agricultural work: 4 slots (8 hours)
- Multiple small tasks: estimate total time

Respond ONLY with valid JSON in this exact format:
{
  "title": "Brief title of the work",
  "estimatedSlots": 2,
  "subtasks": ["task 1", "task 2"],
  "confidence": 0.85
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Parse this work plan (language: ${language}):\n\n"${transcription}"` }]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI parsing failed');
    }

    const aiResponse = await response.json();
    const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('AI response:', content);

    // Parse the JSON response
    let parsed: ParsedPlan;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback to basic parsing
      parsed = {
        title: transcription.substring(0, 50),
        estimatedSlots: 2,
        subtasks: [],
        confidence: 0.5
      };
    }

    // Validate and clamp values
    parsed.estimatedSlots = Math.max(1, Math.min(4, parsed.estimatedSlots || 2));
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
    parsed.subtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];

    console.log('Parsed plan:', parsed);

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-plan:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to parse plan',
        // Return fallback data so UI doesn't break
        title: '',
        estimatedSlots: 2,
        subtasks: [],
        confidence: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
