import { useEffect, useRef } from 'react';

interface Props {
  equation: string;
  reactionType: string;
  playing: boolean;
  speed: number;
}

// 연소 반응 (2H₂ + O₂ → 2H₂O) 시뮬레이션
export default function ReactionSim({ equation, reactionType, playing, speed }: Props) {
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

      if (reactionType === 'combustion') {
        drawCombustionReaction(ctx, cx, cy, W, H, scale, phase, t);
      } else if (reactionType === 'neutralization') {
        drawNeutralizationEquation(ctx, cx, cy, W, H, scale, phase, t);
      } else {
        drawGenericReaction(ctx, cx, cy, W, H, scale, phase, equation, t);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [equation, reactionType, playing, speed]);

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
}

function drawCombustionReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number
) {
  const p = easeInOut(Math.min(1, phase < 1 ? phase : phase < 2 ? 1 : 1));

  if (phase < 1) {
    // 반응물: H₂ + H₂ + O₂
    drawMolLabel(ctx, cx - 140 * scale, cy - 20 * scale, 'H₂', '#aaccff', scale, t);
    drawMolLabel(ctx, cx - 50 * scale,  cy - 20 * scale, 'H₂', '#aaccff', scale, t + 1);
    drawPlus(ctx, cx - 95 * scale, cy - 20 * scale, scale);
    drawPlus(ctx, cx + 10 * scale, cy - 20 * scale, scale);
    drawMolLabel(ctx, cx + 60 * scale,  cy - 20 * scale, 'O₂', '#ff8888', scale, t);
    drawArrowAnim(ctx, cx - 140 * scale, cx + 60 * scale, cy + 40 * scale, scale, p, t);
    drawLabel(ctx, cx, cy - 100 * scale, '2H₂ + O₂ — 반응물', '#aaddff', scale);
  } else if (phase < 2) {
    // 불꽃 애니메이션
    drawFlame(ctx, cx, cy, scale, t);
    drawLabel(ctx, cx, cy - 130 * scale, '점화 → 연소 반응 진행 중', '#ffd700', scale);
  } else {
    // 생성물: H₂O + H₂O
    drawMolLabel(ctx, cx - 60 * scale, cy - 20 * scale, 'H₂O', '#66ccff', scale, t);
    drawMolLabel(ctx, cx + 60 * scale, cy - 20 * scale, 'H₂O', '#66ccff', scale, t + 0.5);
    drawPlus(ctx, cx, cy - 20 * scale, scale);
    ctx.fillStyle = '#ffd700';
    ctx.font = `${13 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('+ 에너지 방출', cx, cy + 50 * scale);
    drawLabel(ctx, cx, cy - 100 * scale, '2H₂O 생성 — 생성물', '#aaffaa', scale);
  }

  drawEquationBox(ctx, '2H₂ + O₂ → 2H₂O  (연소 반응)', W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물', '② 반응 진행', '③ 생성물']);
}

function drawFlame(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, t: number) {
  const layers = [
    { r: 60, color: '#ff4400', alpha: 0.9 },
    { r: 45, color: '#ff8800', alpha: 0.85 },
    { r: 30, color: '#ffcc00', alpha: 0.8 },
    { r: 15, color: '#ffffff', alpha: 0.9 },
  ];
  layers.forEach(({ r, color, alpha }) => {
    const wobbleX = Math.sin(t * 7 + r) * 4 * scale;
    const wobbleY = Math.sin(t * 5 + r * 0.5) * 6 * scale;
    const grad = ctx.createRadialGradient(
      cx + wobbleX, cy - r * scale * 0.3 + wobbleY, 0,
      cx, cy, r * scale
    );
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.ellipse(cx + wobbleX, cy + wobbleY, r * scale * 0.6, r * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawNeutralizationEquation(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, _t: number
) {
  ctx.fillStyle = '#cce0ff';
  ctx.font = `bold ${18 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HCl + NaOH → NaCl + H₂O', cx, cy - 20 * scale);
  ctx.font = `${14 * scale}px sans-serif`;
  ctx.fillStyle = '#88aaff';
  ctx.fillText('산(H⁺ 공여체) + 염기(OH⁻ 공여체) → 염 + 물', cx, cy + 20 * scale);
  drawLabel(ctx, cx, cy - 80 * scale, '중화 반응 (산염기 반응)', '#ffd700', scale);
  drawEquationBox(ctx, 'H⁺ + OH⁻ → H₂O (중화의 핵심)', W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 산염기', '② 이온반응', '③ 생성물']);
}

function drawGenericReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, equation: string, t: number
) {
  // 반응식을 → 기준으로 분리해서 표시
  const parts = equation.split(/[→>-]/);
  const reactants = parts[0]?.trim() ?? '';
  const products = parts[1]?.trim() ?? '';

  if (phase < 1) {
    drawMolLabel(ctx, cx - 60 * scale, cy, reactants, '#aaccff', scale, t);
    drawLabel(ctx, cx, cy - 70 * scale, '반응물', '#aaddff', scale);
  } else if (phase < 2) {
    drawArrowAnim(ctx, cx - 100 * scale, cx + 100 * scale, cy, scale, easeInOut(phase - 1), t);
    drawLabel(ctx, cx, cy - 70 * scale, '반응 진행 중...', '#ffd700', scale);
  } else {
    drawMolLabel(ctx, cx + 60 * scale, cy, products, '#aaffaa', scale, t);
    drawLabel(ctx, cx, cy - 70 * scale, '생성물', '#aaffaa', scale);
  }

  drawEquationBox(ctx, equation, W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물', '② 반응', '③ 생성물']);
}

function drawMolLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string, color: string, scale: number, t: number
) {
  const bob = Math.sin(t * 2) * 5 * scale;
  const r = 35 * scale;
  ctx.beginPath();
  ctx.arc(x, y + bob, r, 0, Math.PI * 2);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${14 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + bob);
}

function drawPlus(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.fillStyle = 'rgba(200,220,255,0.7)';
  ctx.font = `bold ${18 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', x, y);
}

function drawArrowAnim(
  ctx: CanvasRenderingContext2D,
  x1: number, x2: number, y: number, scale: number, progress: number, t: number
) {
  const hl = 12 * scale;
  const endX = x1 + (x2 - x1) * progress;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(endX, y);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();
  if (progress > 0.05) {
    ctx.beginPath();
    ctx.moveTo(endX, y);
    ctx.lineTo(endX - hl, y - hl * 0.5);
    ctx.lineTo(endX - hl, y + hl * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }
  // 이동하는 원자
  const dotX = x1 + (endX - x1) * (Math.sin(t * 4) * 0.5 + 0.5);
  ctx.beginPath();
  ctx.arc(dotX, y - 15 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#ffaa44';
  ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawEquationBox(ctx: CanvasRenderingContext2D, eq: string, W: number, H: number, scale: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce0ff';
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(eq, W / 2, H - 35 * scale);
}

function drawPhaseLabel(
  ctx: CanvasRenderingContext2D,
  phase: number, W: number, scale: number,
  labels: string[]
) {
  const idx = Math.min(labels.length - 1, Math.floor(phase));
  ctx.fillStyle = '#1a2a4a';
  ctx.roundRect(W / 2 - 65 * scale, 12 * scale, 130 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(labels[idx], W / 2, 26 * scale);
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
