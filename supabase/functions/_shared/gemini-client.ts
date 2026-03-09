export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Call the Gemini API. Returns the raw Response object so callers can
 * inspect status codes for custom error handling.
 */
export async function callGeminiRaw(
  model: string,
  apiKey: string,
  contents: any[],
  options?: {
    systemInstruction?: any;
    generationConfig?: any;
  }
): Promise<Response> {
  return fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(options?.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
      ...(options?.generationConfig ? { generationConfig: options.generationConfig } : {}),
    }),
  });
}

/**
 * Call Gemini and return parsed JSON. Throws on non-OK responses.
 */
export async function callGemini(
  model: string,
  apiKey: string,
  contents: any[],
  options?: {
    systemInstruction?: any;
    generationConfig?: any;
  }
) {
  const res = await callGeminiRaw(model, apiKey, contents, options);
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }
  return res.json();
}
