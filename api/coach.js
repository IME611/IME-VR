export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const prompt = body.prompt || body.text || '';
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured in Vercel',
        requiredEnv: 'GEMINI_API_KEY'
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const system = `You are the Vision & Passion Coach for IME VR.
Your job is to turn a user's rough VR scene idea into a useful next-step conversation.
Be concise, practical, and ask only the most important questions needed to define the scene.
Reply in the same language as the user.
Do not generate video yet.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Gemini request failed',
        details: data?.error?.message || data
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || '')
        .join('')
        .trim() || '';

    if (!answer) return res.status(502).json({ error: 'Gemini returned no text' });

    return res.status(200).json({
      status: 'ok',
      answer,
      model,
      chat_id: body.chat_id || body.telegram_chat_id || null,
      scene_id: body.scene_id || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
