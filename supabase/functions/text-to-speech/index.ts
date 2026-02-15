import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect language from text using Unicode character ranges
function detectLanguage(text: string): 'bn-IN' | 'hi-IN' | 'en-IN' {
  // Count characters in each script
  let bengaliCount = 0;
  let hindiCount = 0;
  let latinCount = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    // Bengali Unicode range: U+0980 to U+09FF
    if (code >= 0x0980 && code <= 0x09FF) {
      bengaliCount++;
    }
    // Devanagari (Hindi) Unicode range: U+0900 to U+097F
    else if (code >= 0x0900 && code <= 0x097F) {
      hindiCount++;
    }
    // Basic Latin letters
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
      latinCount++;
    }
  }

  console.log(`Language detection - Bengali: ${bengaliCount}, Hindi: ${hindiCount}, Latin: ${latinCount}`);

  // Return the language with most characters
  if (bengaliCount > hindiCount && bengaliCount > latinCount) {
    return 'bn-IN';
  } else if (hindiCount > bengaliCount && hindiCount > latinCount) {
    return 'hi-IN';
  }
  return 'en-IN';
}

// Get the appropriate Wavenet voice for the language
function getVoiceConfig(languageCode: 'bn-IN' | 'hi-IN' | 'en-IN') {
  const voices: Record<string, { name: string; ssmlGender: string }> = {
    'bn-IN': { name: 'bn-IN-Wavenet-A', ssmlGender: 'FEMALE' }, // Native Bengali female
    'hi-IN': { name: 'hi-IN-Wavenet-A', ssmlGender: 'FEMALE' }, // Native Hindi female
    'en-IN': { name: 'en-IN-Wavenet-A', ssmlGender: 'FEMALE' }, // Indian English female
  };
  return voices[languageCode];
}

// Convert short language code to full code
function toFullLanguageCode(lang: string | null): 'bn-IN' | 'hi-IN' | 'en-IN' {
  if (lang === 'bn') return 'bn-IN';
  if (lang === 'hi') return 'hi-IN';
  if (lang === 'en') return 'en-IN';
  return 'en-IN';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Use explicit language if provided, otherwise detect from text
    const languageCode = language ? toFullLanguageCode(language) : detectLanguage(text);
    const voiceConfig = getVoiceConfig(languageCode);
    
    console.log(`Language: explicit=${language}, resolved=${languageCode}`);

    console.log(`TTS request (Google Cloud): lang=${languageCode}, voice=${voiceConfig.name}`);
    console.log(`Text: ${text.substring(0, 100)}...`);

    const apiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_TTS_API_KEY not configured');
    }

    // Call Google Cloud TTS API
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text },
        voice: {
          languageCode: languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Cloud TTS error:', response.status, errorText);
      throw new Error(`Google Cloud TTS failed: ${errorText}`);
    }

    const data = await response.json();
    console.log('TTS successful, audio generated');

    // Google Cloud returns base64 directly in audioContent field
    return new Response(
      JSON.stringify({ audioContent: data.audioContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('TTS error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
