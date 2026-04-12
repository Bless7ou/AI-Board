import type { VercelRequest, VercelResponse } from '@vercel/node';

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GOOGLE_VISION_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server에 API 키가 설정되지 않았습니다.' });
  }

  const { image } = req.body as { image?: string };
  if (!image) {
    return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
  }

  const response = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          textDetectionParams: { enableTextDetectionConfidenceScore: true },
          languageHints: ['ko', 'en'],
        },
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText;
    return res.status(response.status).json({ error: `Google Vision 오류: ${msg}` });
  }

  const json = await response.json();
  return res.status(200).json(json);
}
