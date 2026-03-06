/**
 * pages/api/ai/chat.js
 * POST /api/ai/chat
 *
 * Optional AI chat endpoint — proxies to Anthropic Claude.
 * The app works fully without this endpoint being called.
 *
 * Body:
 *   { messages: [{role, content}], systemContext?: string }
 *
 * Requires env var: ANTHROPIC_API_KEY
 * (Add to .env.local: ANTHROPIC_API_KEY=sk-ant-...)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI features are not configured. Add ANTHROPIC_API_KEY to .env.local to enable them.',
    });
  }

  const { messages = [], systemContext = '' } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '`messages` must be a non-empty array.' });
  }

  const system = [
    'You are Atlas, an expert AI travel planning assistant.',
    'You give concise, practical, and enthusiastic travel advice.',
    'Format lists with bullet points. Keep responses under 300 words.',
    systemContext,
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages:   messages.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: body.error?.message || `Anthropic API error ${response.status}`,
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text ?? '';
    return res.status(200).json({ content });

  } catch (err) {
    console.error('[ai/chat]', err);
    return res.status(500).json({ error: 'Failed to reach the AI service.' });
  }
}
