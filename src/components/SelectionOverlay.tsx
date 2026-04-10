import { useState, useRef, useEffect } from 'react';

interface Box { x: number; y: number; w: number; h: number; }

interface Props {
  onSelect: (x: number, y: number, w: number, h: number, displayW: number, displayH: number) => void;
  onCancel: () => void;
}

export default function SelectionOverlay({ onSelect, onCancel }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const startRef  = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC 키로 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const getPos = (clientX: number, clientY: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const displaySize = () => {
    const rect = overlayRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 1, h: rect?.height ?? 1 };
  };

  const onStart = (clientX: number, clientY: number) => {
    const pos = getPos(clientX, clientY);
    startRef.current = pos;
    setBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const onMove = (clientX: number, clientY: number) => {
    if (!startRef.current) return;
    const pos = getPos(clientX, clientY);
    setBox({
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    });
  };

  const onEnd = () => {
    if (box && box.w > 20 && box.h > 20) {
      const { w: dW, h: dH } = displaySize();
      onSelect(box.x, box.y, box.w, box.h, dW, dH);
    } else {
      onCancel();
    }
    startRef.current = null;
    setBox(null);
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        cursor: 'crosshair',
      }}
      onMouseDown={(e) => onStart(e.clientX, e.clientY)}
      onMouseMove={(e) => { if (startRef.current) onMove(e.clientX, e.clientY); }}
      onMouseUp={onEnd}
      onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; onStart(t.clientX, t.clientY); }}
      onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }}
      onTouchEnd={onEnd}
    >
      {/* 안내 배너 */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,20,60,0.85)', color: '#88bbff',
        padding: '5px 16px', borderRadius: '20px', fontSize: '12px',
        border: '1px solid rgba(80,140,255,0.35)',
        backdropFilter: 'blur(8px)', pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        인식할 영역을 드래그하세요 &nbsp;·&nbsp; ESC 취소
      </div>

      {/* 전체 어둡게 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.35)', pointerEvents: 'none',
      }} />

      {/* 선택 박스: 선택된 영역은 밝게 */}
      {box && box.w > 4 && box.h > 4 && (
        <>
          {/* 밝은 선택 영역 */}
          <div style={{
            position: 'absolute',
            left: box.x, top: box.y, width: box.w, height: box.h,
            background: 'rgba(0,0,0,0)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            border: '2px solid #66aaff',
            pointerEvents: 'none',
          }} />
          {/* 크기 표시 */}
          <div style={{
            position: 'absolute',
            left: box.x, top: box.y + box.h + 4,
            background: 'rgba(0,20,60,0.8)', color: '#66aaff',
            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
            pointerEvents: 'none',
          }}>
            {Math.round(box.w)} × {Math.round(box.h)}
          </div>
        </>
      )}
    </div>
  );
}
