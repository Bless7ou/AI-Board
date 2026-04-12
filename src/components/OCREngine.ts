import { createWorker } from 'tesseract.js';

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
let isReady = false;

export async function initOCR(onProgress?: (pct: number) => void) {
  if (isReady) return;
  worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  await worker.setParameters({
    tessedit_char_whitelist:
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-→>=()[]',
    // 손글씨 인식률 향상 설정: 한 줄 텍스트 모드(PSM 7)
    tessedit_pageseg_mode: 7 as unknown as undefined,
  });
  isReady = true;
}

/**
 * 캔버스 이미지를 OCR에 적합하게 전처리:
 * - 어두운 배경 + 밝은 글씨 → 흰 배경 + 검은 글씨로 반전
 * - 2배 확대 (작은 글씨 인식률 향상)
 * - 대비 강화 (이진화)
 */
export function preprocessCanvas(sourceDataURL: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;

      // 흰 배경
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 이미지 확대 렌더링
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 픽셀 처리: 밝은 픽셀(글씨) → 검정, 어두운 픽셀(배경) → 흰색
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // 밝기 계산
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        // 밝은 픽셀(글씨) → 검정 / 어두운 픽셀(배경) → 흰색
        const val = brightness > 80 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = sourceDataURL;
  });
}

export async function recognizeImage(imageDataURL: string): Promise<string> {
  if (!worker || !isReady) {
    throw new Error('OCR 엔진이 초기화되지 않았습니다.');
  }
  const processed = await preprocessCanvas(imageDataURL);
  const result = await worker.recognize(processed);
  return result.data.text.trim();
}

export function isOCRReady() {
  return isReady;
}
