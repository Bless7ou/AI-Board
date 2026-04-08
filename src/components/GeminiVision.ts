const ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

const PROMPT = `이 이미지는 전자칠판에 손으로 쓴 화학 수업 내용입니다.
이미지에서 화학식, 반응식, 또는 화학 키워드를 찾아 추출해주세요.

추출 규칙:
- 화학식: H2O, NaCl, CO2, NH3, CH4, HCl, N2, O2, H2 등
- 반응식: 2H2+O2→2H2O 처럼 반응물과 생성물을 → 또는 -> 로 구분
- 한국어 키워드: 이온결합, 공유결합, 산화환원, 산염기, 중화, 연소, 극성 등
- 원소 기호: Na, Cl, O, H, N, C, Fe 등

인식된 내용만 한 줄로 출력하세요. 부가 설명 없이.
예시 출력: H2O
예시 출력: 2H2+O2→2H2O
예시 출력: 이온결합
예시 출력: Na`;

export function getApiKey(): string {
  return import.meta.env.VITE_GEMINI_KEY || localStorage.getItem('gemini_key') || '';
}

export function setApiKey(key: string) {
  localStorage.setItem('gemini_key', key);
}

export async function recognizeHandwriting(imageDataURL: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('API 키가 없습니다. 설정에서 Gemini API 키를 입력해주세요.');

  // base64 부분만 추출 (data:image/png;base64, 제거)
  const base64 = imageDataURL.split(',')[1];
  if (!base64) throw new Error('이미지 데이터가 없습니다.');

  const response = await fetch(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: 'image/png',
              data: base64,
            },
          },
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.1,   // 낮을수록 일관된 출력
        maxOutputTokens: 80,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? response.statusText;
    throw new Error(`Gemini API 오류: ${msg}`);
  }

  const json = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.trim();
}
