const DIRECT_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export function getApiKey(): string {
  return import.meta.env.VITE_GOOGLE_VISION_KEY || localStorage.getItem('google_vision_key') || '';
}

export function setApiKey(key: string) {
  localStorage.setItem('google_vision_key', key);
}

// 이미지 압축 (600×400 이하)
function resizeImage(dataURL: string, maxW = 600, maxH = 400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}

/** 서버리스 프록시 경유 (배포 환경) */
async function callProxy(base64: string): Promise<string> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}

/** Google Vision 직접 호출 (로컬 개발용) */
async function callDirect(base64: string, key: string): Promise<unknown> {
  const res = await fetch(`${DIRECT_ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          textDetectionParams: { enableTextDetectionConfidenceScore: true },
          languageHints: ['ko', 'en'],
        },
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Google Vision 오류: ${msg}`);
  }
  return res.json();
}

export async function recognizeHandwriting(imageDataURL: string): Promise<string> {
  const resized = await resizeImage(imageDataURL);
  const base64 = resized.split(',')[1];
  if (!base64) throw new Error('이미지 데이터가 없습니다.');

  const localKey = getApiKey();

  // 로컬 키가 있으면 직접 호출, 없으면 서버 프록시 경유
  const json = (localKey
    ? await callDirect(base64, localKey)
    : await callProxy(base64)) as {
    responses?: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const r = json.responses?.[0];
  if (r?.error) throw new Error(`Google Vision 오류: ${r.error.message}`);

  const raw = r?.fullTextAnnotation?.text ?? '';
  return raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

