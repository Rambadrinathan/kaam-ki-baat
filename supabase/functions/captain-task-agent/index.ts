import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationMessage {
  role: 'user' | 'ai';
  text: string;
}

interface TeamMember {
  name: string;
  user_id: string;
}

interface TaskDraft {
  title: string;
  description: string;
  estimatedSlots: number;
  assignedToName: string | null;
  assignedToUserId: string | null;
  isOpen: boolean;
}

// Check if text is a simple confirmation - check ALL languages regardless of locked language
// This handles cases where transcription outputs in wrong language
const isSimpleConfirmation = (text: string, lang: string): boolean => {
  const lower = text.toLowerCase().trim();
  const original = text.trim();
  
  // All confirmation patterns - check universally because transcription might be in wrong script
  const allPatterns = [
    // Bengali script
    /^(হ্যাঁ|হাঁ|হ্যা|হা|ঠিক আছে|ঠিক|করো|ওকে)\s*[।.!]?\s*$/i,
    // Hindi/Devanagari script  
    /^(हाँ|हां|हा|ठीक है|ठीक|करो|ओके|सही|हाँ ठीक है|हां ठीक है)\s*[।.!]?\s*$/i,
    // English/Romanized
    /^(yes|ok|okay|confirm|correct|do it|sure|right|yeah|yep|haan|ha|theek|theek hai|thik ache|hyan)\s*[.!]?\s*$/i
  ];
  
  return allPatterns.some(pattern => pattern.test(lower) || pattern.test(original));
};

// Get confirmation text by language
const getConfirmationText = (lang: string): string => {
  const texts: Record<string, string> = {
    bn: '✓ কাজ তৈরি হয়ে গেছে!',
    hi: '✓ काम बन गया!',
    en: '✓ Task created!'
  };
  return texts[lang] || texts.en;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      transcription, 
      teamMembers, 
      conversationHistory, 
      teamName,
      lockedLanguage,
      lastResponseType,
      lastTaskDraft
    } = await req.json();
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // Use locked language or default to 'en'
    const lang = lockedLanguage || 'en';
    
    console.log('Captain task agent called:', {
      transcription,
      lockedLanguage: lang,
      lastResponseType,
      teamMemberCount: teamMembers?.length
    });

    // PRE-AI CHECK: If we have a complete task draft and this is a confirmation, skip AI entirely
    // Check for task draft with title (not just lastResponseType === 'summary')
    const hasPreviousTaskDraft = lastTaskDraft && lastTaskDraft.title;
    if (hasPreviousTaskDraft && isSimpleConfirmation(transcription, lang)) {
      console.log('Confirmation detected with existing task draft - bypassing AI');
      return new Response(JSON.stringify({
        type: 'confirmed',
        text: getConfirmationText(lang),
        detectedLanguage: lang,
        taskDraft: lastTaskDraft
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamMemberNames = teamMembers.map((m: TeamMember) => m.name).join(', ');
    
    // Build conversation context
    const historyContext = conversationHistory.map((msg: ConversationMessage) => 
      `${msg.role === 'user' ? 'Captain' : 'Assistant'}: ${msg.text}`
    ).join('\n');

    // Language-specific instructions - MUCH STRICTER
    const languageInstruction = lang === 'bn' 
      ? `ABSOLUTE LANGUAGE RULE - NO EXCEPTIONS:
- You MUST respond ONLY in Bengali script (বাংলা)
- NEVER use Hindi/Devanagari script (हिंदी) - this is WRONG
- NEVER use Romanized text (like "amar", "tumi", "theek") - this is WRONG  
- Every single word MUST be in Bengali script: অ-ঔ, ক-হ
- Example CORRECT: "কাজ তৈরি হয়ে গেছে!", "কতক্ষণ লাগবে?"
- Example WRONG: "Kaaj toiri hoye geche" or "काम बन गया"
- If you accidentally write Hindi or Roman letters, STOP and rewrite in Bengali`
      : lang === 'hi'
      ? `ABSOLUTE LANGUAGE RULE - NO EXCEPTIONS:
- You MUST respond ONLY in Hindi/Devanagari script (हिंदी)
- NEVER use Bengali script (বাংলা) - this is WRONG
- NEVER use Romanized text (like "kaam", "theek", "acha") - this is WRONG
- Every single word MUST be in Devanagari script: अ-औ, क-ह
- Example CORRECT: "काम बन गया!", "कितना समय लगेगा?"
- Example WRONG: "Kaam ban gaya" or "কাজ তৈরি হয়েছে"
- If you accidentally write Bengali or Roman letters, STOP and rewrite in Hindi`
      : 'You MUST respond ONLY in English. Do NOT use Hindi or Bengali scripts.';

    const systemPrompt = `You are a task creation assistant for a construction/field work app called Kaam Ki Baat.
You help captains (supervisors) create tasks by understanding their voice input.

Team name: ${teamName}
Team members: ${teamMemberNames}

CRITICAL ACCURACY RULES - FOLLOW STRICTLY:
1. Focus PRIMARILY on the LATEST voice input - it is the most important
2. Do NOT assume or fill in missing details from previous conversation unless explicitly referenced
3. If the captain says "না/नहीं/no/wrong/galat/change", COMPLETELY FORGET previous task and start fresh
4. When unclear about what the captain wants, ASK for clarification - do NOT guess
5. Only extract information that is EXPLICITLY stated in the current input
6. If the new input describes a completely different task, discard the old task draft entirely

CRITICAL LANGUAGE RULE:
${languageInstruction}
- Even if the transcription contains words from other languages, YOUR response must be in ${lang === 'bn' ? 'Bengali' : lang === 'hi' ? 'Hindi' : 'English'} ONLY.
- Do NOT switch languages under any circumstances.

Your job:
1. Extract from the captain's voice: task description, duration (hours), and who to assign
2. If ANY information is unclear or missing, ASK a clarifying question
3. Once you have ALL information, provide a SUMMARY and ask for confirmation
4. NEVER ask unnecessary questions - if you have enough info, give summary immediately

DURATION CONVERSION:
- 2 hours = 1 slot
- 4 hours = 2 slots  
- 6 hours = 3 slots
- 8 hours (full day) = 4 slots

ASSIGNMENT RULES:
- If captain says a team member name, match to: ${teamMemberNames}
- If captain says "anyone", "open", "sabko", "যে কেউ", "kisi ko bhi" = open task (isOpen: true)
- If name is unclear, ask for clarification listing team members

CRITICAL CONFIRMATION RULES:
When captain says ANY of these words ALONE or as primary response after you gave a summary:
- Bengali: "হ্যাঁ", "hyan", "ঠিক আছে", "thik ache", "koro", "করো"
- Hindi: "हाँ", "ha", "haan", "ठीक है", "theek hai", "kar do", "करो"
- English: "yes", "ok", "okay", "confirm", "correct", "do it", "sure"

→ You MUST return type: "confirmed" IMMEDIATELY
→ Do NOT ask more questions
→ Do NOT return "change_request" or "question"

ONLY return "change_request" if captain explicitly says: "nahi", "না", "no", "change", "badlo", "बदलो", "wrong", "galat"

RESPOND WITH JSON ONLY:
{
  "type": "question" | "summary" | "confirmed" | "change_request",
  "text": "Your response in ${lang === 'bn' ? 'Bengali' : lang === 'hi' ? 'Hindi' : 'English'} ONLY",
  "detectedLanguage": "${lang}",
  "taskDraft": {
    "title": "Short task title in English",
    "description": "Full description",
    "estimatedSlots": 2,
    "assignedToName": "Name" or null,
    "isOpen": false
  }
}

EXAMPLES (for ${lang === 'bn' ? 'Bengali' : lang === 'hi' ? 'Hindi' : 'English'}):
${lang === 'bn' ? `
Input: "Arup কে godown পরিষ্কার করতে হবে"
Output: {"type":"question","text":"কতক্ষণ লাগবে এই কাজে?","detectedLanguage":"bn"}

Input: "4 ঘন্টা"
Output: {"type":"summary","text":"Arup কে godown পরিষ্কার করতে হবে, 4 ঘন্টা (2 slots)। ঠিক আছে?","detectedLanguage":"bn","taskDraft":{"title":"Godown cleaning","description":"Clean the godown/warehouse","estimatedSlots":2,"assignedToName":"Arup","isOpen":false}}

Input: "হ্যাঁ"
Output: {"type":"confirmed","text":"✓ কাজ তৈরি হয়ে গেছে!","detectedLanguage":"bn","taskDraft":{...}}
` : lang === 'hi' ? `
Input: "Arup को godown साफ करना है"
Output: {"type":"question","text":"कितना समय लगेगा इस काम में?","detectedLanguage":"hi"}

Input: "4 घंटे"
Output: {"type":"summary","text":"Arup को godown cleaning, 4 घंटे (2 slots)। ठीक है?","detectedLanguage":"hi","taskDraft":{"title":"Godown cleaning","description":"Clean the godown/warehouse","estimatedSlots":2,"assignedToName":"Arup","isOpen":false}}

Input: "हाँ"
Output: {"type":"confirmed","text":"✓ काम बन गया!","detectedLanguage":"hi","taskDraft":{...}}
` : `
Input: "Arup should clean the godown"
Output: {"type":"question","text":"How long will this take?","detectedLanguage":"en"}

Input: "4 hours"
Output: {"type":"summary","text":"Arup to clean the godown, 4 hours (2 slots). Confirm?","detectedLanguage":"en","taskDraft":{"title":"Godown cleaning","description":"Clean the godown/warehouse","estimatedSlots":2,"assignedToName":"Arup","isOpen":false}}

Input: "yes"
Output: {"type":"confirmed","text":"✓ Task created!","detectedLanguage":"en","taskDraft":{...}}
`}`;

    const userMessage = historyContext 
      ? `Previous conversation:\n${historyContext}\n\nNew input from captain: "${transcription}"`
      : `Captain's voice input: "${transcription}"`;

    console.log('Calling AI with locked language:', lang);

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
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI error: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('AI raw response:', aiResponse);

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                        aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, aiResponse];
      const jsonStr = jsonMatch[1] || aiResponse;
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback response in correct language
      const fallbackTexts: Record<string, string> = {
        bn: 'দুঃখিত, আবার বলুন।',
        hi: 'माफ़ कीजिए, फिर से बताइए।',
        en: 'Sorry, please try again.'
      };
      parsed = {
        type: 'question',
        text: fallbackTexts[lang] || fallbackTexts.en,
        detectedLanguage: lang
      };
    }

    // Force the detected language to match locked language
    parsed.detectedLanguage = lang;

    // Match team member name to user_id if present
    if (parsed.taskDraft?.assignedToName) {
      const matchedMember = teamMembers.find((m: TeamMember) => 
        m.name.toLowerCase().includes(parsed.taskDraft.assignedToName.toLowerCase()) ||
        parsed.taskDraft.assignedToName.toLowerCase().includes(m.name.toLowerCase())
      );
      if (matchedMember) {
        parsed.taskDraft.assignedToUserId = matchedMember.user_id;
      }
    }
    
    // CRITICAL: If AI returns 'confirmed' without taskDraft, inject lastTaskDraft
    if (parsed.type === 'confirmed' && !parsed.taskDraft && lastTaskDraft) {
      console.log('AI returned confirmed without taskDraft - injecting lastTaskDraft');
      parsed.taskDraft = lastTaskDraft;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Captain task agent error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
