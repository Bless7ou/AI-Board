const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

const PROMPT_HINT =
  'H2O NaCl CO2 NH3 CH4 HCl N2 O2 H2SO4 NaOH CaCO3 Fe2O3 ' +
  '이온결합 공유결합 산화환원 산염기 중화 연소 극성 무극성 ' +
  'Na Cl Fe Ca Mg Al Cu Zn';

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

export async function recognizeHandwriting(imageDataURL: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('API 키가 없습니다. 설정에서 Google Vision API 키를 입력해주세요.');

  const resized = await resizeImage(imageDataURL);
  const base64 = resized.split(',')[1];
  if (!base64) throw new Error('이미지 데이터가 없습니다.');

  const response = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          textDetectionParams: {
            enableTextDetectionConfidenceScore: true,
          },
          languageHints: ['ko', 'en'],
        },
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText;
    throw new Error(`Google Vision 오류: ${msg}`);
  }

  const json = await response.json() as {
    responses?: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  const r = json.responses?.[0];
  if (r?.error) throw new Error(`Google Vision 오류: ${r.error.message}`);

  const raw = r?.fullTextAnnotation?.text ?? '';
  // 줄바꿈 제거, 공백 정리
  return raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// 사용하지 않지만 타입 일관성을 위해 export
export const _ = PROMPT_HINT;
