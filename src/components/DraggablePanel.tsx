import { useState, useRef, useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  initialX: number;
  initialY: number;
  width: number;
  height: number;
  children: ReactNode;
}

export default function DraggablePanel({ title, initialX, initialY, width, height, children }: Props) {
  const [pos, setPos]           = useState({ x: initialX, y: initialY });
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const [longPressed, setLongPressed] = useState(false);  // 꾹 눌렀는지 표시

  const dragRef  = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);  // 실제 드래그 중 여부 (ref로 관리해야 이벤트에서 최신값 참조)

  /* ── 마우스 드래그 (즉시 시작) ── */
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    activeRef.current = true;
    setDragging(true);
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!activeRef.current || !dragRef.current) return;
      setPos({
        x: clamp(dragRef.current.px + e.clientX - dragRef.current.ox, 0, window.innerWidth  - width),
        y: clamp(dragRef.current.py + e.clientY - dragRef.current.oy, 0, window.innerHeight - 100),
      });
    };
    const onUp = () => {
      activeRef.current = false;
      setDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [width]);

  /* ── 터치 꾹 누르기 → 드래그 ── */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const sx = t.clientX, sy = t.clientY;
    const px = pos.x,     py = pos.y;

    // 400ms 꾹 누르면 드래그 활성화
    timerRef.current = setTimeout(() => {
      activeRef.current = true;
      setDragging(true);
      setLongPressed(true);
      dragRef.current = { ox: sx, oy: sy, px, py };
      // 진동 피드백 (지원하는 기기에서)
      navigator.vibrate?.(30);
    }, 400);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!activeRef.current || !dragRef.current) {
      // 꾹 누르기 전에 손가락이 움직이면 타이머 취소
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }
    e.preventDefault();
    const t = e.touches[0];
    setPos({
      x: clamp(dragRef.current.px + t.clientX - dragRef.current.ox, 0, window.innerWidth  - width),
      y: clamp(dragRef.current.py + t.clientY - dragRef.current.oy, 0, window.innerHeight - 100),
    });
  };

  const onTouchEnd = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    activeRef.current = false;
    setDragging(false);
    setLongPressed(false);
  };

  /* ── 렌더 ── */
  const titleBarBg = dragging
    ? 'rgba(60,120,255,0.35)'
    : longPressed
      ? 'rgba(60,120,255,0.2)'
      : 'rgba(10,20,50,0.75)';

  return (
    <div style={{
      position: 'absolute',
      left: pos.x,
      top: pos.y,
      width,
      zIndex: dragging ? 200 : 20,
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'rgba(6, 12, 26, 0.88)',
      border: `1.5px solid ${dragging ? 'rgba(80,140,255,0.6)' : 'rgba(40,80,160,0.35)'}`,
      boxShadow: dragging
        ? '0 8px 32px rgba(40,100,255,0.25)'
        : '0 4px 20px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(14px)',
      transition: dragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s',
      userSelect: 'none',
    }}>

      {/* 드래그 핸들 (타이틀 바) */}
      <div
        style={{
          padding: '5px 10px',
          background: titleBarBg,
          borderBottom: collapsed ? 'none' : '1px solid rgba(40,80,160,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: dragging ? 'grabbing' : 'grab',
          fontSize: '11px', fontWeight: 700,
          color: dragging ? '#88bbff' : '#5577aa',
          transition: 'background 0.2s, color 0.2s',
          touchAction: 'none',
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {dragging && <span style={{ fontSize: '9px', color: '#6699ff' }}>✥ 이동 중</span>}
          {!dragging && <span style={{ fontSize: '9px', color: '#334466', opacity: 0.7 }}>꾹 눌러서 이동</span>}
          {title}
        </span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }}
          style={{
            background: 'none', border: 'none',
            color: '#446688', cursor: 'pointer',
            fontSize: '12px', padding: '0 2px', lineHeight: 1,
          }}
        >{collapsed ? '▲' : '▼'}</button>
      </div>

      {/* 콘텐츠 */}
      {!collapsed && (
        <div style={{ height, overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
