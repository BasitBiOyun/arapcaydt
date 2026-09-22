import { requireMember, serviceDatabase } from '../../server/auth';
export default async function handler(req: any, res: any) {
  const member=await requireMember(req,res);
  if(!member)return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    voices: [
      {
        voice_id: 'eUUtjbi66JcWz3T4Gvvo',
        name: 'Eğitmen Sesi',
        category: 'platform_standard',
        language: 'Turkish & Arabic',
        accent: 'Academic / Clear',
        gender: 'female',
        recommended: true,
      },
    ],
  });
}
