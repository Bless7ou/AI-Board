import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  speed: number;
}

// HCl + NaOH → NaCl + H₂O 중화 반응
export default function AcidBaseSim({ playing, speed }: Props) {
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
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (playing) tRef.current += 0.01 * speed;
      const t = tRef.current;
      const phase = t % 3;

      const scale = Math.min(W, H) / 500;
      const cx = W / 2;
      const cy = H / 2;

      drawBg(ctx, W, H);
      drawPhaseLabel(ctx, phase, W, scale);

      if (phase < 1) {
        // 단계1: 해리 (HCl → H⁺ + Cl⁻, NaOH → Na⁺ + OH⁻)
        const p = easeInOut(phase);
        drawDissociation(ctx, cx, cy, scale, p, t);
        drawLabel(ctx, cx, 55 * scale, 'HCl과 NaOH가 이온으로 해리', '#aaddff', scale);
      } else if (phase < 2) {
        // 단계2: H⁺와 OH⁻ 접근 및 결합
        const p = easeInOut(phase - 1);
        drawNeutralization(ctx, cx, cy, scale, p, t);
        drawLabel(ctx, cx, 55 * scale, 'H⁺ + OH⁻ → H₂O (중화)', '#ffd700', scale);
      } else {
        // 단계3: 최종 산물
        drawProducts(ctx, cx, cy, scale, t);
        drawLabel(ctx, cx, 55 * scale, 'NaCl + H₂O 생성', '#aaffaa', scale);
      }

      drawEquation(ctx, W, H, scale);
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [playing, speed]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
}

function drawDissociation(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, p: number, _t: number
) {
  // HCl 해리 (왼쪽)
  const leftX = cx - 130 * scale;
  const hX = leftX - p * 35 * scale;
  const clX = leftX + p * 35 * scale;

  drawIon(ctx, hX, cy - 30 * scale, 'H⁺', '#ff8888', 22, scale);
  drawIon(ctx, clX, cy + 30 * scale, 'Cl⁻', '#66ff66', 26, scale);

  // NaOH 해리 (오른쪽)
  const rightX = cx + 130 * scale;
  const naX = rightX + p * 35 * scale;
  const ohX = rightX - p * 35 * scale;

  drawIon(ctx, naX, cy - 30 * scale, 'Na⁺', '#cc88ff', 24, scale);
  drawIon(ctx, ohX, cy + 30 * scale, 'OH⁻', '#ff8844', 26, scale);

  // 레이블
  ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('HCl 해리', leftX, cy - 80 * scale);
  ctx.fillText('NaOH 해리', rightX, cy - 80 * scale);
}

function drawNeutralization(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, p: number, t: number
) {
  // H⁺와 OH⁻가 중심으로 이동
  const hX = cx - 100 * scale * (1 - p) - 30 * scale;
  const ohX = cx + 100 * scale * (1 - p) + 30 * scale;

  if (p < 0.8) {
    drawIon(ctx, hX, cy, 'H⁺', '#ff8888', 22, scale);
    drawIon(ctx, ohX, cy, 'OH⁻', '#ff8844', 26, scale);
    // 화살표
    drawArrow(ctx, hX + 25 * scale, cy, ohX - 30 * scale, cy, '#ffff88', scale);
  } else {
    // 결합 → H₂O
    const flash = Math.max(0, (p - 0.8) * 5);
    ctx.globalAlpha = flash;
    drawWaterMolecule(ctx, cx, cy, scale, t);
    ctx.globalAlpha = 1;
  }

  // Na⁺와 Cl⁻ (옆에 남아있음)
  drawIon(ctx, cx - 100 * scale, cy - 70 * scale, 'Na⁺', '#cc88ff', 24, scale);
  drawIon(ctx, cx + 100 * scale, cy - 70 * scale, 'Cl⁻', '#66ff66', 26, scale);
}

function drawProducts(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, t: number) {
  // H₂O
  drawWaterMolecule(ctx, cx - 60 * scale, cy + 20 * scale, scale, t);

  // NaCl 이온쌍
  drawIon(ctx, cx + 80 * scale, cy - 20 * scale, 'Na⁺', '#cc88ff', 26, scale);
  drawIon(ctx, cx + 80 * scale, cy + 40 * scale, 'Cl⁻', '#66ff66', 26, scale);

  // 이온결합선
  ctx.setLineDash([5 * scale, 4 * scale]);
  ctx.strokeStyle = 'rgba(255,215,0,0.5)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(cx + 80 * scale, cy - 20 * scale + 26 * scale);
  ctx.lineTo(cx + 80 * scale, cy + 40 * scale - 26 * scale);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#aaffaa';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('H₂O', cx - 60 * scale, cy + 75 * scale);
  ctx.fillText('NaCl', cx + 80 * scale, cy + 75 * scale);
}

function drawWaterMolecule(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number, t: number
) {
  const rotate = Math.sin(t * 2) * 0.1;
  const oR = 24 * scale;
  const hR = 16 * scale;
  const bondLen = 55 * scale;
  const angle = 52.25 * (Math.PI / 180);

  const h1x = x + Math.cos(Math.PI / 2 + angle + rotate) * bondLen;
  const h1y = y + Math.sin(Math.PI / 2 + angle + rotate) * bondLen;
  const h2x = x + Math.cos(Math.PI / 2 - angle + rotate) * bondLen;
  const h2y = y + Math.sin(Math.PI / 2 - angle + rotate) * bondLen;

  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(h1x, h1y);
  ctx.strokeStyle = 'rgba(150,200,255,0.7)'; ctx.lineWidth = 3 * scale; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(h2x, h2y);
  ctx.stroke();

  // O
  const og = ctx.createRadialGradient(x - oR * 0.3, y - oR * 0.3, oR * 0.1, x, y, oR);
  og.addColorStop(0, '#ff8888'); og.addColorStop(1, '#cc0000');
  ctx.beginPath(); ctx.arc(x, y, oR, 0, Math.PI * 2);
  ctx.fillStyle = og; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * scale}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('O', x, y);

  // H
  [{ x: h1x, y: h1y }, { x: h2x, y: h2y }].forEach((h) => {
    const hg = ctx.createRadialGradient(h.x - hR * 0.3, h.y - hR * 0.3, hR * 0.1, h.x, h.y, hR);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#aaaaaa');
    ctx.beginPath(); ctx.arc(h.x, h.y, hR, 0, Math.PI * 2);
    ctx.fillStyle = hg; ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = `bold ${11 * scale}px monospace`;
    ctx.fillText('H', h.x, h.y);
  });
}

function drawIon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  label: string, color: string, r: number, scale: number
) {
  const rr = r * scale;
  const grad = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr);
  grad.addColorStop(0, lighten(color, 50));
  grad.addColorStop(1, darken(color, 30));
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = isLight(color) ? '#111' : '#fff';
  ctx.font = `bold ${12 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, scale: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const hl = 10 * scale;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * hl + uy * hl * 0.5, y2 - uy * hl - ux * hl * 0.5);
  ctx.lineTo(x2 - ux * hl - uy * hl * 0.5, y2 - uy * hl + ux * hl * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawPhaseLabel(ctx: CanvasRenderingContext2D, phase: number, W: number, scale: number) {
  const labels = ['① 이온 해리', '② 중화 반응', '③ 생성물'];
  const idx = Math.min(2, Math.floor(phase));
  ctx.fillStyle = '#1a2a4a';
  ctx.roundRect(W / 2 - 65 * scale, 12 * scale, 130 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(labels[idx], W / 2, 26 * scale);
}

function drawEquation(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce0ff';
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HCl + NaOH → NaCl + H₂O  |  산 + 염기 → 염 + 물', W / 2, H - 35 * scale);
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  if (c.length === 3) return [parseInt(c[0]+c[0],16), parseInt(c[1]+c[1],16), parseInt(c[2]+c[2],16)];
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
