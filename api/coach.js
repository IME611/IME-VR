export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || body.text || '').trim();
    const context = String(body.context || '').trim();
    const chatId = body.chat_id || body.telegram_chat_id || null;
    const isStart = /^\\/start(?:@\\w+)?$/i.test(prompt);

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured',
        requiredEnv: 'GEMINI_API_KEY'
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const system = `You are the Vision & Passion Coach for IME VR.

Your job is to guide the user through building a complete VR experience, one step at a time.
Use the conversation context when it is provided. Never ask the user to repeat information already present in the context.
Reply in the same language as the user.
Be concise, practical, and natural for Telegram.
Do not generate video yet.
When enough information has been collected, summarize the defined scene and identify the next concrete step.
Do not invent missing user preferences; ask for them when they materially affect the scene.`;

    const effectiveContext = isStart ? '' : context;
    const userInput = effectiveContext
      ? `CONVERSATION CONTEXT:
${effectiveContext}

NEW USER MESSAGE:
${prompt}`
      : (isStart
        ? 'Start a new VR scene-building session. Ask the user the three most important questions needed to define the scene.'
        : prompt);

    const maxAttempts = 3;
    let lastStatus = 502;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: userInput }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1200
            }
          }),
          signal: AbortSignal.timeout(30000)
        }
      );

      const data = await response.json();

      if (response.ok) {
        const answer = data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

        if (answer) {
          return res.status(200).json({
            status: 'ok',
            answer,
            model,
            provider: 'gemini',
            chat_id: chatId,
            scene_id: body.scene_id || null
          });
        }

        return res.status(502).json({
          error: 'Gemini returned no text',
          provider: 'gemini'
        });
      }

      lastStatus = response.status;
      const retryable = [429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === maxAttempts - 1) {
        return res.status(response.status).json({
          error: 'Gemini request failed',
          provider: 'gemini',
          status: response.status
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
    }

    return res.status(lastStatus).json({
      error: 'Gemini request failed',
      provider: 'gemini'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Coach service failed',
      detail: error?.message || 'Unknown error'
    });
  }
}
