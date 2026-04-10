import { useState, useRef, useEffect, type ReactNode } from 'react';

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
  children: ReactNode;
}

type ResizeDir = 's' | 'e' | 'se';

export default function FloatPanel({
  title, defaultX, defaultY, defaultW, defaultH,
  minW = 180, minH = 120, zBase = 20, hidden = false, children,
}: Props) {
  const [pos,      setPos]      = useState({ x: defaultX, y: defaultY });
  const [size,     setSize]     = useState({ w: defaultW, h: defaultH });
  const [moveMode, setMoveMode] = useState(false);
  const [elevated, setElevated] = useState(false);

  // ── refs: 이벤트 핸들러에서 항상 최신값 참조 ──
  const moveModeRef = useRef(false);          // moveMode 상태 미러
  const posRef      = useRef(pos);            // pos 상태 미러
  const sizeRef     = useRef(size);           // size 상태 미러

  const isDragging  = useRef(false);
  const isResizing  = useRef(false);
  const dragOrigin  = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeOrigin= useRef<{ ox: number; oy: number; ow: number; oh: number; dir: ResizeDir } | null>(null);
  const lastTapMs   = useRef(0);

  // 상태 변경마다 ref 동기화
  useEffect(() => { moveModeRef.current = moveMode; }, [moveMode]);
  useEffect(() => { posRef.current  = pos;  }, [pos]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  /* ── 글로벌 mousemove / mouseup ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging.current && dragOrigin.current) {
        const { ox, oy, px, py } = dragOrigin.current;
        setPos({ x: Math.max(0, px + e.clientX - ox), y: Math.max(0, py + e.clientY - oy) });
      }
      if (isResizing.current && resizeOrigin.current) {
        const { ox, oy, ow, oh, dir } = resizeOrigin.current;
        const dx = e.clientX - ox, dy = e.clientY - oy;
        setSize(prev => ({
          w: dir !== 's' ? Math.max(minW, ow + dx) : prev.w,
          h: dir !== 'e' ? Math.max(minH, oh + dy) : prev.h,
        }));
      }
    };
    const onUp = () => {
      isDragging.current = false;
      isResizing.current = false;
      dragOrigin.current = null;
      resizeOrigin.current = null;
      setElevated(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [minW, minH]);

  /* ── 타이틀바: 마우스 ── */
  const onTitleMouseDown = (e: React.MouseEvent) => {
    if (!moveModeRef.current) return;
    e.preventDefault();
    isDragging.current = true;
    setElevated(true);
    dragOrigin.current = { ox: e.clientX, oy: e.clientY, px: posRef.current.x, py: posRef.current.y };
  };

  const onTitleDblClick = () => setMoveMode(v => !v);

  /* ── 타이틀바: 터치 ── */
  // DOM 이벤트로 등록해야 passive:false 제어 가능
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    let dragStart: { ox: number; oy: number; px: number; py: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // 브라우저 기본 줌/스크롤 차단

      // 더블탭 감지 (350ms 이내 두 번)
      const now = Date.now();
      if (now - lastTapMs.current < 350) {
        moveModeRef.current = !moveModeRef.current;
        setMoveMode(moveModeRef.current);
        lastTapMs.current = 0;
        dragStart = null;
        return;
      }
      lastTapMs.current = now;

      // 이동 모드일 때만 드래그 시작
      if (!moveModeRef.current) return;
      const t = e.touches[0];
      dragStart = { ox: t.clientX, oy: t.clientY, px: posRef.current.x, py: posRef.current.y };
      setElevated(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!moveModeRef.current || !dragStart) return;
      const t = e.touches[0];
      setPos({
        x: Math.max(0, dragStart.px + t.clientX - dragStart.ox),
        y: Math.max(0, dragStart.py + t.clientY - dragStart.oy),
      });
    };

    const onTouchEnd = () => {
      dragStart = null;
      setElevated(false);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []); // 마운트 시 한 번만 — 내부에서 ref로 최신값 참조

  /* ── 리사이즈 핸들: 마우스 ── */
  const startResizeMouse = (e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    setElevated(true);
    resizeOrigin.current = { ox: e.clientX, oy: e.clientY, ow: sizeRef.current.w, oh: sizeRef.current.h, dir };
  };

  /* ── 리사이즈 핸들: 터치 ── */
  const makeResizeTouchHandlers = (dir: ResizeDir) => {
    let origin: { ox: number; oy: number; ow: number; oh: number } | null = null;

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      origin = { ox: t.clientX, oy: t.clientY, ow: sizeRef.current.w, oh: sizeRef.current.h };
      setElevated(true);
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!origin) return;
      const t = e.touches[0];
      const dx = t.clientX - origin.ox, dy = t.clientY - origin.oy;
      setSize(prev => ({
        w: dir !== 's' ? Math.max(minW, origin!.ow + dx) : prev.w,
        h: dir !== 'e' ? Math.max(minH, origin!.oh + dy) : prev.h,
      }));
    };
    const onEnd = () => { origin = null; setElevated(false); };

    return (el: HTMLDivElement | null) => {
      if (!el) return;
      el.addEventListener('touchstart', onStart, { passive: false });
      el.addEventListener('touchmove',  onMove,  { passive: false });
      el.addEventListener('touchend',   onEnd);
    };
  };

  // 리사이즈 핸들 ref callbacks (마운트 시 한 번 등록)
  const attachS  = useRef(makeResizeTouchHandlers('s'));
  const attachE  = useRef(makeResizeTouchHandlers('e'));
  const attachSE = useRef(makeResizeTouchHandlers('se'));

  return (
    <div style={{
      position: 'absolute',
      left: pos.x, top: pos.y,
      width: size.w, height: size.h,
      zIndex: elevated ? zBase + 100 : zBase,
      display: hidden ? 'none' : 'flex',
      flexDirection: 'column',
      background: 'rgba(6,12,26,0.9)',
      border: `1.5px solid ${moveMode ? 'rgba(80,150,255,0.75)' : 'rgba(40,80,160,0.4)'}`,
      borderRadius: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(14px)',
      boxShadow: elevated
        ? '0 8px 32px rgba(40,100,255,0.3)'
        : '0 4px 24px rgba(0,0,0,0.6)',
      userSelect: 'none',
    }}>

      {/* 타이틀 바 */}
      <div
        ref={titleRef}
        onMouseDown={onTitleMouseDown}
        onDoubleClick={onTitleDblClick}
        style={{
          padding: '5px 10px',
          background: moveMode ? 'rgba(40,90,220,0.38)' : 'rgba(10,20,50,0.75)',
          borderBottom: '1px solid rgba(40,70,130,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: moveMode ? (elevated ? 'grabbing' : 'grab') : 'default',
          fontSize: '11px', fontWeight: 700,
          color: moveMode ? '#88bbff' : '#4a6a99',
          flexShrink: 0,
          transition: 'background 0.2s, color 0.2s',
          touchAction: 'none',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9, opacity: 0.55, fontWeight: 400 }}>
          {moveMode ? '✥ 이동 모드 — 더블탭 해제' : '더블탭 → 이동'}
        </span>
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {children}
      </div>

      {/* 아래쪽 가장자리 리사이즈 */}
      <div
        ref={attachS.current}
        onMouseDown={(e) => startResizeMouse(e, 's')}
        style={{
          position: 'absolute', bottom: 0, left: 14, right: 14, height: 7,
          cursor: 's-resize', zIndex: 10, touchAction: 'none',
        }}
      />

      {/* 오른쪽 가장자리 리사이즈 */}
      <div
        ref={attachE.current}
        onMouseDown={(e) => startResizeMouse(e, 'e')}
        style={{
          position: 'absolute', top: 14, right: 0, bottom: 14, width: 7,
          cursor: 'e-resize', zIndex: 10, touchAction: 'none',
        }}
      />

      {/* 오른쪽 하단 코너 리사이즈 */}
      <div
        ref={attachSE.current}
        onMouseDown={(e) => startResizeMouse(e, 'se')}
        style={{
          position: 'absolute', bottom: 0, right: 0, width: 16, height: 16,
          cursor: 'se-resize', zIndex: 11, touchAction: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9" style={{ opacity: 0.45, display: 'block' }}>
          <path d="M1 9 L9 1 M5 9 L9 5" stroke="#88aaff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

    </div>
  );
}
