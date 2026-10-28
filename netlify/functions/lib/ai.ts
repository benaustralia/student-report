// Drafts the bilingual report from a teacher's notes. The OpenAI key stays on the server;
// the browser only ever sees /api/ai-draft.
import { HttpError, json, readJson } from './http.ts';

const SYSTEM_PROMPT = 'You are a bilingual educator in Australia creating student progress reports. Generate a bilingual report with BOTH English and Chinese sections. Format: [English text] [Chinese text]. Both sections should be casual, warm-hearted, and friendly - like talking to parents. The Chinese section should match the conversational, warm tone of English (like chatting with friends, not a formal academic report). Avoid overly formal or academic language. Focus on student progress, creativity, engagement, and achievements with genuine warmth. Use teacher notes as foundation. If notes are Chinese dot points, transform into proper sentences. Keep student names in English in both languages. Each language section must be complete and meaningful. Generate natural, flowing text without section headers. CRITICAL: Your response MUST be EXACTLY 430 characters or less (no exceptions). This is a hard limit for a printed certificate. Count characters as you write. Target: ~200 English chars + ~200 Chinese chars = ~400 total. Write concisely. Shorten immediately if over limit.';

interface DraftRequest { firstName?: string; lastName?: string; classLevel?: string; notes?: string }

export type Completer = (messages: Array<{ role: string; content: string }>) => Promise<string>;

export const openAiCompleter: Completer = async messages => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, 'AI drafting is not configured (OPENAI_API_KEY missing)');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.2 }),
  });
  if (!res.ok) throw new HttpError(502, `OpenAI returned ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
};

export const handleAiDraft = async (req: Request, complete: Completer = openAiCompleter): Promise<Response> => {
  if (req.method !== 'POST') throw new HttpError(405, 'POST required');
  const body = await readJson<DraftRequest>(req);
  const notes = (body.notes ?? '').trim();
  if (!notes) throw new HttpError(400, 'notes required');
  const text = await complete([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Student: ${body.firstName ?? ''} ${body.lastName ?? ''}\nClass: ${body.classLevel ?? ''}\nBullets: ${notes}` },
  ]);
  // Strip the [English] / [Chinese] markers the prompt asks for, as the old client did.
  return json({ text: text.replace(/\[.*?\]/g, '').trim() });
};
