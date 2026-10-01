export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const prompt = body.prompt || body.text || '';
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const system = `You are the Vision & Passion Coach for IME VR.
Turn a rough VR scene idea into a useful next-step conversation.
Be concise, practical, and ask only the most important questions needed to define the scene.
Reply in the same language as the user.
Do not generate video yet.`;

    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: 'Gemini request failed', details: data?.error?.message || data });
      const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
      if (answer) return res.status(200).json({ status: 'ok', answer, model, provider: 'gemini', chat_id: body.chat_id || body.telegram_chat_id || null, scene_id: body.scene_id || null });
    }

    if (openaiKey) {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 800 })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: 'OpenAI request failed', details: data?.error?.message || data });
      const answer = data?.choices?.[0]?.message?.content?.trim() || '';
      if (answer) return res.status(200).json({ status: 'ok', answer, model, provider: 'openai', chat_id: body.chat_id || body.telegram_chat_id || null, scene_id: body.scene_id || null });
    }

    const answer = `קיבלתי: “${prompt}”

כדי לבנות את סצנת ה‑VR, נגדיר קודם 3 דברים:
1. מה בדיוק רואים בסצנה?
2. איזו אווירה ותחושה אתה רוצה?
3. כמה זמן בערך נמשכת החוויה?

תענה חופשי, ואני אמשיך לבנות איתך את הסצנה.`;

    return res.status(200).json({ status: 'ok', answer, model: 'fallback-coach', provider: 'fallback', chat_id: body.chat_id || body.telegram_chat_id || null, scene_id: body.scene_id || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
