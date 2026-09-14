function normalizeApiKey(value?: string): string {
  let key = (value || '').trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = normalizeApiKey(process.env.ELEVENLABS_API_KEY);
  const configured = Boolean(apiKey && apiKey !== 'MY_ELEVENLABS_API_KEY');

  if (!configured) {
    return res.status(200).json({
      configured: false,
      valid: false,
      mode: 'unconfigured',
      message: 'ELEVENLABS_API_KEY Vercel ortamında tanımlanmamış.',
    });
  }

  try {
    const upstream = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!upstream.ok) {
      const raw = await upstream.text();
      let detail = '';
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.detail?.message || parsed?.detail?.status || parsed?.detail || parsed?.message || '';
      } catch {
        detail = raw.slice(0, 200);
      }

      return res.status(200).json({
        configured: true,
        valid: false,
        mode: 'live',
        upstreamStatus: upstream.status,
        message:
          upstream.status === 401
            ? 'API anahtarı Vercel ortamında var fakat ElevenLabs tarafından geçersiz olarak reddedildi.'
            : upstream.status === 403
              ? 'API anahtarı Vercel ortamında var fakat izin veya IP kısıtlaması nedeniyle reddedildi.'
              : `API anahtarı bulundu fakat servis doğrulaması başarısız oldu (${upstream.status})${detail ? `: ${String(detail)}` : ''}`,
      });
    }

    const subscription: any = await upstream.json();
    const characterLimit = Number(subscription?.character_limit || 0);
    const characterCount = Number(subscription?.character_count || 0);

    return res.status(200).json({
      configured: true,
      valid: true,
      mode: 'live',
      tier: subscription?.tier || null,
      status: subscription?.status || null,
      remainingCharacters:
        characterLimit > 0 ? Math.max(0, characterLimit - characterCount) : null,
      message: 'Ses servisi hazır.',
    });
  } catch (error: any) {
    console.error('[ElevenLabs status network error]', error);
    return res.status(200).json({
      configured: true,
      valid: false,
      mode: 'live',
      message: `API anahtarı bulundu ancak ElevenLabs bağlantısı doğrulanamadı: ${error?.message || 'Ağ hatası'}`,
    });
  }
}
