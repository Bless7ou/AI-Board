import { useRef, useEffect, useCallback, useState } from 'react';
import { recognizeHandwriting } from './GoogleVision';

interface Props {
  /** 인식 성공 시 텍스트 전달 */
  onRecognize: (text: string) => void;
  /** 닫기 */
  onClose: () => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  width?: number;
  height?: number;
}

const BG = '#0e1a2a';

export default function MiniCanvas({
  onRecognize, onClose,
  placeholder = '여기에 화학식을 쓰세요',
  width = 240, height = 100,
}: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  // ★ state로 변경 — 리렌더 트리거해서 버튼 disabled 해제
  const [hasStrokes, setHasStrokes] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState('');

  // ── 캔버스 초기화 ──
  const clearCanvas = useCallback(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    // HiDPI 스케일 적용 상태이므로 논리 크기(width, height)로 지우기
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    // 플레이스홀더
    ctx.fillStyle = 'rgba(100,140,200,0.3)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(placeholder, width / 2, height / 2);
    setHasStrokes(false);
    setError('');
  }, [placeholder, width, height]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    // 물리 해상도 2x
    cv.width = width * 2;
    cv.height = height * 2;
    cv.style.width = `${width}px`;
    cv.style.height = `${height}px`;
    const ctx = cv.getContext('2d');
    if (ctx) ctx.scale(2, 2);
    clearCanvas();
  }, [width, height, clearCanvas]);

  // ── 좌표 변환: CSS 좌표 → 캔버스 논리 좌표 ──
  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const cv = cvRef.current!;
    const rect = cv.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    // rect 크기는 CSS 크기 = 논리 크기, 그대로 사용
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drawing.current = true;
    const pos = getPos(e);
    lastPt.current = pos;
    if (!hasStrokes) {
      // 첫 획 — 플레이스홀더 지우기
      const ctx = cvRef.current?.getContext('2d');
      if (ctx) { ctx.fillStyle = BG; ctx.fillRect(0, 0, width, height); }
      setHasStrokes(true);
    }
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !lastPt.current) return;
    e.preventDefault();
    e.stopPropagation();
    const ctx = cvRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPt.current = pos;
  };

  const onUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    drawing.current = false;
    lastPt.current = null;
  };

  // ── 인식 ──
  const handleRecognize = async () => {
    const cv = cvRef.current;
    if (!cv || !hasStrokes) return;
    // 로컬 키 없어도 서버 프록시로 동작 가능하므로 체크 제거

    setRecognizing(true); setError('');
    try {
      const dataURL = cv.toDataURL('image/png');
      const text = await recognizeHandwriting(dataURL);
      if (!text.trim()) { setError('인식 실패 — 더 크게 써보세요'); return; }
      onRecognize(text.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : '인식 오류');
    } finally {
      setRecognizing(false);
    }
  };

  return (
    <div
      style={{
        background: 'rgba(8,14,30,0.97)',
        border: '1px solid rgba(60,120,240,0.35)',
        borderRadius: 12, padding: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', gap: 8,
        width: width + 20,
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* 캔버스 */}
      <canvas
        ref={cvRef}
        style={{
          borderRadius: 8,
          border: `1px solid ${hasStrokes ? 'rgba(80,160,255,0.4)' : 'rgba(60,100,180,0.3)'}`,
          cursor: 'crosshair',
          touchAction: 'none',
          display: 'block',
        }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => onUp()}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} onTouchCancel={() => onUp()}
      />

      {/* 에러 */}
      {error && (
        <div style={{ fontSize: 10, color: '#ff7766', textAlign: 'center' }}>{error}</div>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleRecognize}
          disabled={recognizing || !hasStrokes}
          style={{
            flex: 1, padding: '5px 0',
            background: recognizing ? 'rgba(40,80,160,0.3)'
              : hasStrokes ? 'rgba(40,100,220,0.5)' : 'rgba(20,40,70,0.4)',
            border: `1px solid ${hasStrokes ? 'rgba(80,150,255,0.5)' : 'rgba(40,70,110,0.3)'}`,
            borderRadius: 7,
            color: hasStrokes ? '#aaccff' : '#445566',
            fontSize: 12, fontWeight: 700,
            cursor: hasStrokes ? 'pointer' : 'default',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {recognizing ? '인식 중...' : '🔍 인식'}
        </button>
        <button
          onClick={clearCanvas}
          style={{
            padding: '5px 10px',
            background: 'rgba(30,40,60,0.6)',
            border: '1px solid rgba(60,80,120,0.4)',
            borderRadius: 7, color: '#5577aa',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          지우기
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '5px 10px',
            background: 'rgba(30,40,60,0.6)',
            border: '1px solid rgba(60,80,120,0.4)',
            borderRadius: 7, color: '#5577aa',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
