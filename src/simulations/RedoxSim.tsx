import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  speed: number;
}

/**
 * 산화환원 반응 애니메이션
 * Zn + Cu²⁺ → Zn²⁺ + Cu
 * Phase 0–1: 반응물 (Zn 원자, Cu²⁺ 이온)
 * Phase 1–2: 전자 이동 (2e⁻ Zn → Cu²⁺)
 * Phase 2–3: 생성물 (Zn²⁺ 이온, Cu 원자)
 */
export default function RedoxSim({ playing, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (playing) tRef.current += 0.008 * speed;
      const t = tRef.current;
      const CYCLE = 3;
      const phase = t % CYCLE; // 0~3 반복

      drawBg(ctx, W, H);

      const scale = Math.min(W, H) / 480;
      const cx = W / 2;
      const cy = H / 2;
      const leftX = cx - 120 * scale;
      const rightX = cx + 120 * scale;

      drawTitle(ctx, W, scale, phase);

      if (phase < 1) {
        // ── Phase 0~1: 반응물 ──
        const alpha = Math.min(1, phase < 0.1 ? phase * 10 : 1);
        // Zn 원자 (좌)
        drawAtom(ctx, leftX, cy, 36 * scale, '#88ccff', 'Zn', '', alpha, Math.sin(t * 1.5) * 4 * scale);
        // Cu²⁺ 이온 (우)
        drawAtom(ctx, rightX, cy, 32 * scale, '#ffaa44', 'Cu', '2+', alpha, Math.sin(t * 1.5 + 1) * 4 * scale);

        drawHalfReaction(ctx, leftX, cy + 90 * scale, 'Zn → Zn²⁺ + 2e⁻', '#88ccff', scale, alpha);
        drawHalfReaction(ctx, rightX, cy + 90 * scale, 'Cu²⁺ + 2e⁻ → Cu', '#ffaa44', scale, alpha);
        drawOxRedLabel(ctx, leftX, cy - 80 * scale, '산 화', '#88ccff', scale, alpha);
        drawOxRedLabel(ctx, rightX, cy - 80 * scale, '환 원', '#ffaa44', scale, alpha);

      } else if (phase < 2) {
        // ── Phase 1~2: 전자 이동 ──
        const p = easeInOut((phase - 1));

        // 두 원자는 자리 유지 (서서히 변화)
        const znAlpha = 1 - p * 0.3;
        const cuAlpha = 1;
        drawAtom(ctx, leftX, cy, 36 * scale, '#88ccff', 'Zn', '', znAlpha, 0);
        drawAtom(ctx, rightX, cy, 32 * scale, '#ffaa44', 'Cu', '2+', cuAlpha, 0);

        // 전자 2개 이동
        for (let i = 0; i < 2; i++) {
          const offset = (i - 0.5) * 28 * scale;
          const ex = leftX + (rightX - leftX) * p + offset * (1 - p);
          const ey = cy - 30 * scale - Math.sin(Math.PI * p) * 50 * scale + offset * 0.3;
          drawElectron(ctx, ex, ey, scale, p, i);
        }

        // 진행 화살표
        drawProgressArrow(ctx, leftX, rightX, cy + 10 * scale, scale, p);

        drawLabel(ctx, cx, cy + 90 * scale, `전자 이동 중 (${Math.round(p * 100)}%)`, '#ffd700', scale);
        drawOxRedLabel(ctx, leftX, cy - 80 * scale, '산 화', '#88ccff', scale, 1);
        drawOxRedLabel(ctx, rightX, cy - 80 * scale, '환 원', '#ffaa44', scale, 1);

      } else {
        // ── Phase 2~3: 생성물 ──
        const alpha = Math.min(1, (phase - 2) * 5);
        const bob = Math.sin(t * 2) * 3 * scale;

        // Zn²⁺ 이온 (좌)
        drawAtom(ctx, leftX, cy, 30 * scale, '#aaddff', 'Zn', '2+', alpha, bob);
        // Cu 원자 (우) - 반짝 효과
        drawAtom(ctx, rightX, cy, 36 * scale, '#ffcc66', 'Cu', '', alpha, -bob);
        if (alpha > 0.5) drawSparkle(ctx, rightX, cy - 42 * scale, scale, t);

        drawHalfReaction(ctx, leftX, cy + 90 * scale, '산화됨: Zn²⁺', '#aaddff', scale, alpha);
        drawHalfReaction(ctx, rightX, cy + 90 * scale, '환원됨: Cu', '#ffcc66', scale, alpha);
        drawOxRedLabel(ctx, leftX, cy - 80 * scale, '산 화 ✓', '#88ccff', scale, alpha);
        drawOxRedLabel(ctx, rightX, cy - 80 * scale, '환 원 ✓', '#ffaa44', scale, alpha);
      }

      drawEquationBox(ctx, 'Zn  +  Cu²⁺  →  Zn²⁺  +  Cu', W, H, scale);
      drawPhaseBar(ctx, phase, W, H, scale);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [playing, speed]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ── 헬퍼 함수 ──────────────────────────────────────────────

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#080818');
  g.addColorStop(1, '#0c1828');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx: CanvasRenderingContext2D, W: number, scale: number, phase: number) {
  const labels = ['① 반응물 배치', '② 전자 이동', '③ 생성물 형성'];
  const idx = Math.min(2, Math.floor(phase));
  ctx.fillStyle = 'rgba(10,20,40,0.75)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 80 * scale, 10 * scale, 160 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.fillStyle = '#88ccff';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labels[idx], W / 2, 24 * scale);
}

function drawAtom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  color: string, symbol: string, charge: string,
  alpha: number, bob: number,
) {
  ctx.globalAlpha = alpha;
  const gy = y + bob;

  // 빛나는 후광
  const glow = ctx.createRadialGradient(x, gy, r * 0.4, x, gy, r * 1.6);
  glow.addColorStop(0, `${color}33`);
  glow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, gy, r * 1.6, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // 원
  const grad = ctx.createRadialGradient(x - r * 0.3, gy - r * 0.3, r * 0.1, x, gy, r);
  grad.addColorStop(0, lighten(color, 0.4));
  grad.addColorStop(1, darken(color, 0.4));
  ctx.beginPath();
  ctx.arc(x, gy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = `${color}cc`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 기호
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${r * 0.75}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, gy);

  // 전하
  if (charge) {
    ctx.fillStyle = charge.includes('+') ? '#ff8866' : '#88aaff';
    ctx.font = `bold ${r * 0.5}px sans-serif`;
    ctx.fillText(charge, x + r * 0.75, gy - r * 0.65);
  }

  ctx.globalAlpha = 1;
}

function drawElectron(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  _progress: number, idx: number,
) {
  const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.01 + idx);
  const r = 7 * scale * pulse;

  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  g.addColorStop(0, '#aaccff');
  g.addColorStop(0.4, '#4488ff');
  g.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, r * 2, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#88bbff';
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${9 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('e⁻', x, y);
}

function drawProgressArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, x2: number, y: number,
  scale: number, progress: number,
) {
  const endX = x1 + (x2 - x1) * progress;
  ctx.beginPath();
  ctx.moveTo(x1 + 45 * scale, y);
  ctx.lineTo(endX - 45 * scale, y);
  ctx.strokeStyle = `rgba(255,210,50,${0.3 + progress * 0.7})`;
  ctx.lineWidth = 2 * scale;
  ctx.setLineDash([6 * scale, 4 * scale]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHalfReaction(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string,
  color: string, scale: number, alpha: number,
) {
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = `${color}22`;
  const w = 150 * scale;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 12 * scale, w, 24 * scale, 5 * scale);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `${11 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function drawOxRedLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string,
  color: string, scale: number, alpha: number,
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `bold ${14 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.globalAlpha = 1;
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string,
  color: string, scale: number,
) {
  ctx.fillStyle = color;
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawEquationBox(
  ctx: CanvasRenderingContext2D,
  eq: string, W: number, H: number, scale: number,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(10 * scale, H - 58 * scale, W - 20 * scale, 48 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce8ff';
  ctx.font = `${13 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(eq, W / 2, H - 34 * scale);
}

function drawPhaseBar(
  ctx: CanvasRenderingContext2D,
  phase: number, W: number, H: number, scale: number,
) {
  const bw = (W - 40 * scale);
  const bh = 4 * scale;
  const bx = 20 * scale;
  const by = H - 12 * scale;
  const progress = (phase % 3) / 3;

  ctx.fillStyle = 'rgba(80,120,200,0.2)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();

  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw * progress, bh, bh / 2);
  ctx.fill();
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number, t: number,
) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + t * 3;
    const r = 12 * scale + Math.sin(t * 5 + i) * 3 * scale;
    const sx = x + Math.cos(angle) * r;
    const sy = y + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,80,${0.6 + Math.sin(t * 4 + i) * 0.4})`;
    ctx.fill();
  }
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
