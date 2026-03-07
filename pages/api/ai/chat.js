/**
 * pages/api/ai/chat.js
 * POST /api/ai/chat
 *
 * Optional AI chat endpoint — uses DeepSeek (or Anthropic as fallback).
 *
 * Body:
 *   { messages: [{role, content}], systemContext?: string }
 *
 * Requires env var: DEEPSEEK_API_KEY (or ANTHROPIC_API_KEY)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!deepseekKey && !anthropicKey) {
    return res.status(503).json({
      error: 'AI features are not configured. Add DEEPSEEK_API_KEY or ANTHROPIC_API_KEY to .env.local.',
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
    let content;

    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model:    'deepseek-chat',
          max_tokens: 600,
          messages: [
            { role: 'system', content: system },
            ...messages.map(({ role, content }) => ({ role, content })),
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: body.error?.message || `DeepSeek API error ${response.status}`,
        });
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content ?? '';
    } else {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:    'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system,
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: body.error?.message || `Anthropic API error ${response.status}`,
        });
      }

      const data = await response.json();
      content = data.content?.[0]?.text ?? '';
    }

    return res.status(200).json({ content });

  } catch (err) {
    console.error('[ai/chat]', err);
    return res.status(500).json({ error: 'Failed to reach the AI service.' });
  }
}
