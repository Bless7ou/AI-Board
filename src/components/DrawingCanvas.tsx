import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────
export type ToolType   = 'pen' | 'eraser' | 'laser';
export type EraserMode = 'point' | 'stroke';

interface Props {
  penColor:   string;
  penSize:    number;
  tool:       ToolType;
  eraserMode: EraserMode;
  eraserSize: number;
}

export interface DrawingCanvasHandle {
  getImageDataURL:        () => string;
  getCroppedImageDataURL: (x: number, y: number, w: number, h: number, dW: number, dH: number) => string;
  clear: () => void;
  undo:  () => void;
  redo:  () => void;
}

// ─── Internal types ───────────────────────────────────────────────────────────
interface Pt     { x: number; y: number }
interface Stroke { points: Pt[]; color: string; size: number; isEraser: boolean }

// ─── Constants ────────────────────────────────────────────────────────────────
const CW       = 4800;
const CH       = 3200;
const BG       = '#1b2b22';   // 눈 편한 어두운 칠판색
const GRID_PX  = 40;
const GRID_CLR = 'rgba(255,255,255,0.038)';
const MAX_HIST = 50;

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.strokeStyle = GRID_CLR;
  ctx.lineWidth   = 0.8;
  for (let x = 0; x <= CW; x += GRID_PX) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
  }
  for (let y = 0; y <= CH; y += GRID_PX) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle   = s.color;
  ctx.lineWidth   = s.size;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (s.points.length === 1) {
    ctx.beginPath();
    ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function redrawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  drawBg(ctx);
  for (const s of strokes) drawStroke(ctx, s);
}

function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function strokeHits(s: Stroke, x: number, y: number, r: number): boolean {
  const pts = s.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(x - pts[0].x, y - pts[0].y) < r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (ptSegDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < r) return true;
  }
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(
  ({ penColor, penSize, tool, eraserMode, eraserSize }, ref) => {
    const wrapRef   = useRef<HTMLDivElement>(null);
    const cvRef     = useRef<HTMLCanvasElement>(null);
    const laserRef  = useRef<HTMLCanvasElement>(null);
    const mmRef     = useRef<HTMLCanvasElement>(null);

    // Prop mirrors (avoid stale closures in event handlers registered once)
    const tRef  = useRef(tool);
    const cRef  = useRef(penColor);
    const sRef  = useRef(penSize);
    const emRef = useRef(eraserMode);
    const esRef = useRef(eraserSize);
    useEffect(() => { tRef.current  = tool;       }, [tool]);
    useEffect(() => { cRef.current  = penColor;   }, [penColor]);
    useEffect(() => { sRef.current  = penSize;    }, [penSize]);
    useEffect(() => { emRef.current = eraserMode; }, [eraserMode]);
    useEffect(() => { esRef.current = eraserSize; }, [eraserSize]);

    // Pan
    const panX    = useRef(0);
    const panY    = useRef(0);
    const panning = useRef(false);
    const panOrg  = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
    const spaceDown = useRef(false); // desktop: space = pan mode

    // Drawing
    const drawing  = useRef(false);
    const curStroke = useRef<Stroke | null>(null);
    const strokes   = useRef<Stroke[]>([]);
    const hist      = useRef<Stroke[][]>([[]]);
    const hIdx      = useRef(0);

    // Laser — screen-space coordinates (relative to container, no pan offset)
    const lasering  = useRef(false);
    const laserPts  = useRef<{ sx: number; sy: number; t: number }[]>([]);
    const laserRAF  = useRef(0);

    // ── helpers ─────────────────────────────────────────────────────────────
    const ctx2d  = () => cvRef.current?.getContext('2d') ?? null;

    const applyPan = useCallback((nx: number, ny: number) => {
      const wrap = wrapRef.current;
      const cv   = cvRef.current;
      if (!wrap || !cv) return;
      panX.current = Math.max(0, Math.min(CW - wrap.clientWidth,  nx));
      panY.current = Math.max(0, Math.min(CH - wrap.clientHeight, ny));
      cv.style.transform = `translate(${-panX.current}px,${-panY.current}px)`;
    }, []);

    const toCanvas = useCallback((cx: number, cy: number): Pt => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: cx - r.left + panX.current, y: cy - r.top + panY.current };
    }, []);

    const saveHist = useCallback(() => {
      hist.current.splice(hIdx.current + 1);
      hist.current.push(strokes.current.map(s => ({ ...s, points: [...s.points] })));
      if (hist.current.length > MAX_HIST) hist.current.shift();
      hIdx.current = hist.current.length - 1;
    }, []);

    // ── minimap ─────────────────────────────────────────────────────────────
    const showMM = useCallback((visible: boolean) => {
      const mm = mmRef.current;
      if (!mm) return;
      mm.style.opacity = visible ? '1' : '0';
    }, []);

    const drawMM = useCallback(() => {
      const mm   = mmRef.current;
      const wrap = wrapRef.current;
      const cv   = cvRef.current;
      if (!mm || !wrap || !cv) return;
      const ctx = mm.getContext('2d');
      if (!ctx) return;
      const W = mm.width, H = mm.height;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(cv, 0, 0, CW, CH, 0, 0, W, H);
      const sx = W / CW, sy = H / CH;
      ctx.strokeStyle = 'rgba(80,220,140,0.9)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(
        panX.current * sx, panY.current * sy,
        wrap.clientWidth * sx, wrap.clientHeight * sy,
      );
    }, []);

    // ── Laser loop ──────────────────────────────────────────────────────────
    const laserTick = useCallback(() => {
      const lc = laserRef.current;
      if (!lc) return;
      const ctx = lc.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, lc.width, lc.height);
      const now  = Date.now();
      const FADE = 500;
      laserPts.current = laserPts.current.filter(p => now - p.t < FADE + 80);
      const pts = laserPts.current;

      for (let i = 1; i < pts.length; i++) {
        const a  = Math.max(0, 1 - (now - pts[i].t) / FADE);
        // pts already stores screen coords — use directly
        const sx = pts[i].sx;   const sy = pts[i].sy;
        const sx0= pts[i-1].sx; const sy0= pts[i-1].sy;
        ctx.beginPath();
        ctx.moveTo(sx0, sy0); ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(255,55,45,${a * 0.8})`;
        ctx.lineWidth   = 3.5;
        ctx.lineCap     = 'round';
        ctx.shadowColor = `rgba(255,100,40,${a})`;
        ctx.shadowBlur  = 10;
        ctx.stroke();
        ctx.shadowBlur  = 0;
      }
      if (pts.length > 0) {
        const last = pts[pts.length - 1];
        const sx = last.sx;
        const sy = last.sy;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle  = '#ff4030';
        ctx.shadowColor= 'rgba(255,120,40,1)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (lasering.current || pts.length > 0) {
        laserRAF.current = requestAnimationFrame(laserTick);
      } else {
        ctx.clearRect(0, 0, lc.width, lc.height);
      }
    }, []);

    // ── Pointer handlers (used by both mouse and touch) ──────────────────────
    const toScreen = useCallback((cx: number, cy: number): { sx: number; sy: number } => {
      const r = wrapRef.current?.getBoundingClientRect();
      return { sx: cx - (r?.left ?? 0), sy: cy - (r?.top ?? 0) };
    }, []);

    const onDown = useCallback((cx: number, cy: number) => {
      const pos = toCanvas(cx, cy);
      if (tRef.current === 'laser') {
        lasering.current = true;
        laserPts.current = [{ ...toScreen(cx, cy), t: Date.now() }];
        cancelAnimationFrame(laserRAF.current);
        laserRAF.current = requestAnimationFrame(laserTick);
        return;
      }
      drawing.current = true;
      const isEr = tRef.current === 'eraser';
      curStroke.current = {
        points:   [pos],
        color:    isEr ? BG : cRef.current,
        size:     isEr ? esRef.current : sRef.current,
        isEraser: isEr,
      };
      // draw initial dot
      const ctx = ctx2d();
      if (ctx && !isEr) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, sRef.current / 2, 0, Math.PI * 2);
        ctx.fillStyle = cRef.current;
        ctx.fill();
      }
    }, [toCanvas, toScreen, laserTick]);

    const onMove = useCallback((cx: number, cy: number) => {
      if (tRef.current === 'laser') {
        if (!lasering.current) return;
        laserPts.current.push({ ...toScreen(cx, cy), t: Date.now() });
        return;
      }
      if (!drawing.current || !curStroke.current) return;
      const pos  = toCanvas(cx, cy);
      const prev = curStroke.current.points.at(-1)!;
      curStroke.current.points.push(pos);
      const ctx  = ctx2d();
      if (!ctx) return;

      if (tRef.current === 'eraser' && emRef.current === 'stroke') {
        const r = esRef.current;
        const before = strokes.current.length;
        strokes.current = strokes.current.filter(s => s.isEraser || !strokeHits(s, pos.x, pos.y, r));
        if (strokes.current.length !== before) redrawAll(ctx, strokes.current);
        return;
      }

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x,  pos.y);
      ctx.strokeStyle = tRef.current === 'eraser' ? BG : cRef.current;
      ctx.lineWidth   = tRef.current === 'eraser' ? esRef.current : sRef.current;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.stroke();
    }, [toCanvas, toScreen]);

    const onUp = useCallback(() => {
      if (tRef.current === 'laser') { lasering.current = false; return; }
      if (!drawing.current || !curStroke.current) return;
      drawing.current = false;
      const s = curStroke.current;
      curStroke.current = null;
      if (s.points.length > 0) {
        strokes.current.push(s);
        saveHist();
      }
    }, [saveHist]);

    // ── Canvas init ──────────────────────────────────────────────────────────
    useEffect(() => {
      const cv = cvRef.current;
      if (!cv) return;
      cv.width  = CW;
      cv.height = CH;
      drawBg(cv.getContext('2d')!);

      // laser canvas: viewport-sized
      const onResize = () => {
        const wrap = wrapRef.current;
        const lc   = laserRef.current;
        if (!wrap || !lc) return;
        lc.width  = wrap.clientWidth;
        lc.height = wrap.clientHeight;
      };
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    // ── Mouse events (desktop) ───────────────────────────────────────────────
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat) { e.preventDefault(); spaceDown.current = true; }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') spaceDown.current = false;
      };

      const onMDown = (e: MouseEvent) => {
        if (spaceDown.current) {
          panning.current = true;
          panOrg.current  = { tx: e.clientX, ty: e.clientY, px: panX.current, py: panY.current };
          return;
        }
        onDown(e.clientX, e.clientY);
      };
      const onMMove = (e: MouseEvent) => {
        if (panning.current) {
          applyPan(panOrg.current.px - (e.clientX - panOrg.current.tx),
                   panOrg.current.py - (e.clientY - panOrg.current.ty));
          drawMM(); showMM(true);
          return;
        }
        onMove(e.clientX, e.clientY);
      };
      const onMUp = () => {
        if (panning.current) {
          panning.current = false; showMM(false); return;
        }
        onUp();
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup',   onKeyUp);
      wrap.addEventListener('mousedown', onMDown);
      wrap.addEventListener('mousemove', onMMove);
      window.addEventListener('mouseup',  onMUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup',   onKeyUp);
        wrap.removeEventListener('mousedown', onMDown);
        wrap.removeEventListener('mousemove', onMMove);
        window.removeEventListener('mouseup',  onMUp);
      };
    }, [onDown, onMove, onUp, applyPan, drawMM, showMM]);

    // ── Touch events (iPad) ──────────────────────────────────────────────────
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      let hideTimer: ReturnType<typeof setTimeout>;

      const onTStart = (e: TouchEvent) => {
        const t    = e.touches[0];
        const type = (t as unknown as { touchType?: string }).touchType;
        if (type === 'stylus') {
          e.preventDefault();
          onDown(t.clientX, t.clientY);
        } else {
          e.preventDefault();
          panning.current = true;
          panOrg.current  = { tx: t.clientX, ty: t.clientY, px: panX.current, py: panY.current };
          clearTimeout(hideTimer);
          drawMM(); showMM(true);
        }
      };

      const onTMove = (e: TouchEvent) => {
        e.preventDefault();
        const t    = e.touches[0];
        const type = (t as unknown as { touchType?: string }).touchType;
        if (type === 'stylus') {
          onMove(t.clientX, t.clientY);
        } else if (panning.current) {
          applyPan(panOrg.current.px - (t.clientX - panOrg.current.tx),
                   panOrg.current.py - (t.clientY - panOrg.current.ty));
          drawMM();
        }
      };

      const onTEnd = (e: TouchEvent) => {
        e.preventDefault();
        const t    = e.changedTouches[0];
        const type = (t as unknown as { touchType?: string }).touchType;
        if (type === 'stylus') {
          onUp();
        } else {
          panning.current = false;
          hideTimer = setTimeout(() => showMM(false), 1500);
        }
      };

      wrap.addEventListener('touchstart', onTStart, { passive: false });
      wrap.addEventListener('touchmove',  onTMove,  { passive: false });
      wrap.addEventListener('touchend',   onTEnd,   { passive: false });
      return () => {
        clearTimeout(hideTimer);
        wrap.removeEventListener('touchstart', onTStart);
        wrap.removeEventListener('touchmove',  onTMove);
        wrap.removeEventListener('touchend',   onTEnd);
      };
    }, [onDown, onMove, onUp, applyPan, drawMM, showMM]);

    // ── Imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getImageDataURL: () => {
        const cv = cvRef.current, wrap = wrapRef.current;
        if (!cv || !wrap) return '';
        const W = wrap.clientWidth, H = wrap.clientHeight;
        const tmp = document.createElement('canvas');
        tmp.width = W; tmp.height = H;
        tmp.getContext('2d')!.drawImage(cv, panX.current, panY.current, W, H, 0, 0, W, H);
        return tmp.toDataURL('image/png');
      },
      getCroppedImageDataURL: (x, y, w, h, dW, dH) => {
        const cv = cvRef.current, wrap = wrapRef.current;
        if (!cv || !wrap) return '';
        const sx = wrap.clientWidth / dW, sy = wrap.clientHeight / dH;
        const cx = Math.round(x * sx) + panX.current;
        const cy = Math.round(y * sy) + panY.current;
        const cw = Math.round(w * sx), ch = Math.round(h * sy);
        const tmp = document.createElement('canvas');
        tmp.width = cw; tmp.height = ch;
        tmp.getContext('2d')!.drawImage(cv, cx, cy, cw, ch, 0, 0, cw, ch);
        return tmp.toDataURL('image/png');
      },
      clear: () => {
        strokes.current = [];
        saveHist();
        const ctx = ctx2d();
        if (ctx) drawBg(ctx);
      },
      undo: () => {
        if (hIdx.current <= 0) return;
        hIdx.current--;
        strokes.current = hist.current[hIdx.current].map(s => ({ ...s, points: [...s.points] }));
        const ctx = ctx2d(); if (ctx) redrawAll(ctx, strokes.current);
      },
      redo: () => {
        if (hIdx.current >= hist.current.length - 1) return;
        hIdx.current++;
        strokes.current = hist.current[hIdx.current].map(s => ({ ...s, points: [...s.points] }));
        const ctx = ctx2d(); if (ctx) redrawAll(ctx, strokes.current);
      },
    }));

    const cursor =
      spaceDown.current ? 'grab' :
      tool === 'laser'  ? 'none' :
      tool === 'eraser' ? 'cell' : 'crosshair';

    return (
      <div ref={wrapRef} style={{
        position: 'relative', width: '100%', height: '100%',
        overflow: 'hidden', background: BG, cursor,
        userSelect: 'none',
      }}>
        {/* Main drawing canvas */}
        <canvas ref={cvRef} style={{
          position: 'absolute', top: 0, left: 0,
          display: 'block', touchAction: 'none',
        }} />

        {/* Laser overlay (viewport-sized) */}
        <canvas ref={laserRef} style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', touchAction: 'none',
        }} />

        {/* Minimap (always in DOM, toggled via opacity) */}
        <canvas ref={mmRef} width={168} height={112} style={{
          position: 'absolute', bottom: 14, right: 14,
          width: 168, height: 112,
          borderRadius: 8,
          border: '1px solid rgba(80,200,120,0.35)',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          zIndex: 8,
          pointerEvents: 'none',
        }} />
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
