import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface Props {
  title: string;
  defaultX: number;
  defaultY: number;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  zBase?: number;
  hidden?: boolean;
  onClose?: () => void;
  children: ReactNode;
}

type Edge = 'right' | 'bottom' | 'corner';

export default function FloatPanel({
  title, defaultX, defaultY, defaultW, defaultH,
  minW = 180, minH = 120, zBase = 20, hidden = false, onClose, children,
}: Props) {
  // ── 뷰포트 크기 추적 ──
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── clamp 헬퍼: 위치·크기가 뷰포트를 벗어나지 않도록 ──
  const clampSize = useCallback((w: number, h: number, x: number, y: number) => ({
    w: Math.max(minW, Math.min(w, vw - x)),
    h: Math.max(minH, Math.min(h, vh - y)),
  }), [minW, minH, vw, vh]);

  const clampPos = useCallback((x: number, y: number, w: number, _h: number) => ({
    x: Math.max(0, Math.min(x, vw - Math.min(w, 80))),
    y: Math.max(0, Math.min(y, vh - 32)),
  }), [vw, vh]);

  // ── 초기값을 뷰포트에 맞게 보정 ──
  const initW = Math.max(minW, Math.min(defaultW, vw - defaultX));
  const initH = Math.max(minH, Math.min(defaultH, vh - defaultY));

  const [pos,  setPos]  = useState({ x: defaultX, y: defaultY });
  const [size, setSize] = useState({ w: initW, h: initH });
  const [moveMode,  setMoveMode]  = useState(false);
  const [elevated,  setElevated]  = useState(false);

  // ── 뷰포트 변경 시 패널이 밖으로 나가지 않도록 재조정 ──
  useEffect(() => {
    setSize(prev => clampSize(prev.w, prev.h, pos.x, pos.y));
    setPos(prev => clampPos(prev.x, prev.y, size.w, size.h));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vw, vh]);

  // ── refs ──
  const moveModeRef = useRef(false);
  const posRef  = useRef(pos);
  const sizeRef = useRef(size);

  useEffect(() => { moveModeRef.current = moveMode; }, [moveMode]);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // ═══════════════════════════════════════════════════════════
  //  DRAG MOVE (타이틀바)
  // ═══════════════════════════════════════════════════════════
  const isDragging = useRef(false);
  const dragOrigin = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const lastTapMs  = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !dragOrigin.current) return;
      const { ox, oy, px, py } = dragOrigin.current;
      const nx = px + e.clientX - ox;
      const ny = py + e.clientY - oy;
      const c = clampPos(nx, ny, sizeRef.current.w, sizeRef.current.h);
      setPos(c);
    };
    const onUp = () => {
      isDragging.current = false;
      dragOrigin.current = null;
      setElevated(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [clampPos]);

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if (!moveModeRef.current) return;
    e.preventDefault();
    isDragging.current = true;
    setElevated(true);
    dragOrigin.current = { ox: e.clientX, oy: e.clientY, px: posRef.current.x, py: posRef.current.y };
  };
  const onTitleDblClick = () => setMoveMode(v => !v);

  // ── 타이틀바 터치 이동 ──
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    let dragStart: { ox: number; oy: number; px: number; py: number } | null = null;
    let dragTouchId: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      // 닫기 버튼 등 자식 요소에서 시작된 터치는 무시
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastTapMs.current < 350) {
        moveModeRef.current = !moveModeRef.current;
        setMoveMode(moveModeRef.current);
        lastTapMs.current = 0;
        return;
      }
      lastTapMs.current = now;
      if (!moveModeRef.current) return;
      const t = e.changedTouches[0];
      dragTouchId = t.identifier;
      dragStart = { ox: t.clientX, oy: t.clientY, px: posRef.current.x, py: posRef.current.y };
      setElevated(true);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!moveModeRef.current || !dragStart || dragTouchId === null) return;
      const t = Array.from(e.touches).find(touch => touch.identifier === dragTouchId);
      if (!t) return;
      const nx = dragStart.px + t.clientX - dragStart.ox;
      const ny = dragStart.py + t.clientY - dragStart.oy;
      setPos({
        x: Math.max(0, Math.min(nx, window.innerWidth - 80)),
        y: Math.max(0, Math.min(ny, window.innerHeight - 32)),
      });
    };
    const onTouchEnd = (e: TouchEvent) => {
      const ended = Array.from(e.changedTouches).find(t => t.identifier === dragTouchId);
      if (ended) { dragStart = null; dragTouchId = null; setElevated(false); }
    };
    const onTouchCancel = () => { dragStart = null; dragTouchId = null; setElevated(false); };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchCancel);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  DRAG RESIZE (우측/하단/코너 핸들)
  // ═══════════════════════════════════════════════════════════
  const resizing    = useRef(false);
  const resizeEdge  = useRef<Edge>('corner');
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  const startResize = useCallback((e: React.MouseEvent | React.TouchEvent, edge: Edge) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    resizeEdge.current = edge;
    setElevated(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeStart.current = { mx: clientX, my: clientY, w: sizeRef.current.w, h: sizeRef.current.h };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!resizing.current || !resizeStart.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const { mx, my, w, h } = resizeStart.current;
      const edge = resizeEdge.current;

      const maxW = window.innerWidth - posRef.current.x;
      const maxH = window.innerHeight - posRef.current.y;

      let nw = w;
      let nh = h;
      if (edge === 'right' || edge === 'corner') nw = w + (clientX - mx);
      if (edge === 'bottom' || edge === 'corner') nh = h + (clientY - my);

      setSize({
        w: Math.max(minW, Math.min(nw, maxW)),
        h: Math.max(minH, Math.min(nh, maxH)),
      });
    };
    const onUp = () => {
      if (resizing.current) {
        resizing.current = false;
        resizeStart.current = null;
        setElevated(false);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [minW, minH]);

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════
  const HANDLE = 8;

  return (
    <div style={{
      position: 'absolute',
      left: pos.x, top: pos.y,
      width: size.w, height: size.h,
      zIndex: elevated ? zBase + 100 : zBase,
      display: hidden ? 'none' : 'flex',
      flexDirection: 'column',
      background: 'rgba(6,12,26,0.95)',
      border: `1.5px solid ${moveMode ? 'rgba(80,150,255,0.75)' : 'rgba(40,80,160,0.4)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: elevated ? '0 8px 32px rgba(40,100,255,0.3)' : '0 4px 24px rgba(0,0,0,0.6)',
      userSelect: 'none',
    }}>

      {/* 타이틀 바 */}
      <div
        ref={titleRef}
        onMouseDown={onTitleMouseDown}
        onDoubleClick={onTitleDblClick}
        style={{
          padding: '4px 8px',
          background: moveMode ? 'rgba(40,90,220,0.38)' : 'rgba(10,20,50,0.75)',
          borderBottom: '1px solid rgba(40,70,130,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: moveMode ? (elevated ? 'grabbing' : 'grab') : 'default',
          fontSize: '11px', fontWeight: 700,
          color: moveMode ? '#88bbff' : '#4a6a99',
          flexShrink: 0,
          gap: 6,
          transition: 'background 0.2s, color 0.2s',
          touchAction: 'none',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
          <span style={{ fontSize: 9, opacity: 0.5, fontWeight: 400, marginLeft: 6 }}>
            {moveMode ? '✥ 이동' : '더블탭→이동'}
          </span>
        </span>
        {onClose && (
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(80,100,140,0.3)',
              color: '#6a8099', cursor: 'pointer', borderRadius: 5,
              fontSize: 13, lineHeight: 1, padding: '4px 7px',
              flexShrink: 0, transition: 'color 0.15s, background 0.15s',
              touchAction: 'auto',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.color = '#ff7766'; b.style.background = 'rgba(255,60,40,0.15)'; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.color = '#6a8099'; b.style.background = 'rgba(255,255,255,0.05)'; }}
            title="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {children}
      </div>

      {/* ── 리사이즈 핸들: 우측 ── */}
      <div
        onMouseDown={e => startResize(e, 'right')}
        onTouchStart={e => startResize(e, 'right')}
        style={{
          position: 'absolute', top: HANDLE, right: 0, bottom: HANDLE,
          width: HANDLE, cursor: 'ew-resize', touchAction: 'none',
        }}
      />
      {/* ── 리사이즈 핸들: 하단 ── */}
      <div
        onMouseDown={e => startResize(e, 'bottom')}
        onTouchStart={e => startResize(e, 'bottom')}
        style={{
          position: 'absolute', left: HANDLE, right: HANDLE, bottom: 0,
          height: HANDLE, cursor: 'ns-resize', touchAction: 'none',
        }}
      />
      {/* ── 리사이즈 핸들: 우하단 코너 ── */}
      <div
        onMouseDown={e => startResize(e, 'corner')}
        onTouchStart={e => startResize(e, 'corner')}
        style={{
          position: 'absolute', right: 0, bottom: 0,
          width: HANDLE * 2, height: HANDLE * 2,
          cursor: 'nwse-resize', touchAction: 'none',
        }}
      >
        {/* 코너 그립 표시 */}
        <svg width={HANDLE * 2} height={HANDLE * 2} viewBox="0 0 16 16" style={{ opacity: 0.35 }}>
          <path d="M14 4L4 14M14 8L8 14M14 12L12 14" stroke="#6688bb" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

    </div>
  );
}
