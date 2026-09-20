export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const message = body.message || {};
    const text = message.text || "מדיטציה בשקיעה בקוסמוי";
    const chatId = message.chat?.id;

    const makeWebhookUrl = process.env.MAKE_ORCHESTRATOR_WEBHOOK;

    if (!makeWebhookUrl) {
      return res.status(500).json({ error: 'MAKE_ORCHESTRATOR_WEBHOOK environment variable is missing' });
    }

    const response = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_id: `vr_${Date.now()}`,
        telegram_chat_id: chatId,
        prompt: text,
        requested_format: 'VR180_SBS_4K',
        status: 'initiated'
      })
    });

    return res.status(200).json({
      status: 'completed',
      message: 'Scene task dispatched to Make orchestrator'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
