import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS as corsHeaders, callGeminiRaw } from '../_shared/gemini-client.ts';

// Stricter prompt that FORCES output in the specified language when locked
const getSystemPrompt = (language: string) => {
  const isLocked = language === 'hi' || language === 'bn';

  if (isLocked) {
    const languageName = language === 'hi' ? 'Hindi' : 'Bengali';
    const scriptName = language === 'hi' ? 'Devanagari (हिंदी)' : 'Bengali script (বাংলা)';
    const yesExample = language === 'hi' ? 'हाँ, हां' : 'হ্যাঁ, হাঁ';

    return `You are transcribing audio for a work planning app.

CRITICAL: The conversation is LOCKED to ${languageName}.
This means the speaker is speaking ${languageName} and you MUST output in ${scriptName} ONLY.

ABSOLUTE RULES:
- Output ONLY in ${scriptName} - no exceptions
- Even if you hear English words mixed in, write them phonetically in ${scriptName}
- For "yes" confirmations, write: ${yesExample}
- NEVER output Romanized text (like "haan", "theek", "koro")
- NEVER output in the wrong script (${language === 'hi' ? 'Bengali' : 'Hindi'})

Context: Work planning app for field workers in India.
Topics: painting, gardening, construction, cleaning, time estimates, locations.

Return ONLY the transcription in ${scriptName}. Nothing else.`;
  }

  // Default English - allow detection
  return `You are transcribing audio for a work planning app used by field workers in India.

Transcribe the spoken audio. If the speaker uses Hindi, write in Devanagari. If Bengali, use Bengali script. If English, use English.

Context: Work planning app. Topics: painting, gardening, construction, cleaning, time estimates, locations.

Return ONLY the transcription text, nothing else.`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, language = 'en' } = await req.json();

    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log(`Transcribing audio in language: ${language}`);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = getSystemPrompt(language);

    const response = await callGeminiRaw(
      'gemini-2.5-flash',
      GEMINI_API_KEY,
      [{
        role: 'user',
        parts: [
          { text: 'Transcribe this audio recording of a worker describing their work plan:' },
          { inlineData: { mimeType: 'audio/webm', data: audio } }
        ]
      }],
      { systemInstruction: { parts: [{ text: systemPrompt }] } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`Transcription result (${language}):`, transcription);

    return new Response(
      JSON.stringify({ text: transcription, language }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
