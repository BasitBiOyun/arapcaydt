export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const configured = Boolean(apiKey && apiKey.trim() && apiKey !== 'MY_ELEVENLABS_API_KEY');

  return res.status(200).json({
    configured,
    mode: configured ? 'live' : 'unconfigured',
    message: configured
      ? 'Ses servisi hazır.'
      : 'ELEVENLABS_API_KEY Vercel ortamında tanımlanmamış.',
  });
}
