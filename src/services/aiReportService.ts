import type { Class, Student } from '@/types';

export async function generateBilingualReport({ student, classData, notes, apiKey }: { student: Student; classData: Class; notes: string; apiKey: string | undefined; }): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || ''}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a bilingual educator in Australia creating student progress reports. Generate a bilingual report with BOTH English and Chinese sections. Format: [English text] [Chinese text]. Both sections should be casual, warm-hearted, and friendly - like talking to parents. The Chinese section should match the conversational, warm tone of English (like chatting with friends, not a formal academic report). Avoid overly formal or academic language. Focus on student progress, creativity, engagement, and achievements with genuine warmth. Use teacher notes as foundation. If notes are Chinese dot points, transform into proper sentences. Keep student names in English in both languages. Each language section must be complete and meaningful. Generate natural, flowing text without section headers. CRITICAL: Your response MUST be EXACTLY 430 characters or less (no exceptions). This is a hard limit for a printed certificate. Count characters as you write. Target: ~200 English chars + ~200 Chinese chars = ~400 total. Write concisely. Shorten immediately if over limit.' },
        { role: 'user', content: `Student: ${student.firstName} ${student.lastName}\nClass: ${classData.classLevel}\nBullets: ${notes}` }
      ],
      max_tokens: 120,
      temperature: 0.2
    })
  });
  if (!response.ok) throw new Error('Failed to generate AI report');
  const data = await response.json();
  let generatedText: string = data.choices?.[0]?.message?.content?.trim() || '';
  return generatedText.replace(/\[.*?\]/g, '').trim();
}
