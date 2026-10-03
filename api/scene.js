export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const message = body.message || {};
    const prompt = String(body.prompt || message.text || '').trim();
    const chatId = body.chat_id || message.chat?.id || null;
    const makeWebhookUrl = process.env.MAKE_ORCHESTRATOR_WEBHOOK;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (!makeWebhookUrl) {
      return res.status(500).json({
        error: 'Scene orchestrator is not configured',
        requiredEnv: 'MAKE_ORCHESTRATOR_WEBHOOK'
      });
    }

    const sceneId = body.scene_id || `vr_${Date.now()}`;

    const response = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_id: sceneId,
        telegram_chat_id: chatId,
        prompt,
        requested_format: body.requested_format || 'VR180_SBS_4K',
        status: 'initiated'
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return res.status(502).json({
        error: 'Scene orchestrator request failed',
        status: response.status
      });
    }

    return res.status(200).json({
      status: 'dispatched',
      scene_id: sceneId
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Scene dispatch failed',
      detail: error?.message || 'Unknown error'
    });
  }
}
