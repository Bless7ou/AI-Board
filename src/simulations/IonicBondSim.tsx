import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  speed: number;
}

// NaCl 이온결합 형성 시뮬레이션
export default function IonicBondSim({ playing, speed }: Props) {
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

      if (playing) tRef.current += 0.012 * speed;
      // 0~1 → 0~1 → 0~1 루프 (총 3단계)
      const phase = tRef.current % 3; // 0: 접근, 1: 전자이동, 2: 결합유지

      const scale = Math.min(W, H) / 500;
      const cx = W / 2;
      const cy = H / 2 - 20 * scale;

      drawBackground(ctx, W, H);
      drawStageLabel(ctx, phase, W, scale);

      // --- 단계별 렌더링 ---
      if (phase < 1) {
        // 단계1: Na와 Cl이 서로 접근
        const progress = easeInOut(phase);
        const dist = 180 * scale * (1 - progress * 0.5);
        drawNaAtom(ctx, cx - dist, cy, scale, 0);
        drawClAtom(ctx, cx + dist, cy, scale, 0);
        drawElectronShells(ctx, cx - dist, cy, scale, 11, 0);
        drawElectronShells(ctx, cx + dist, cy, scale, 17, 0);
        drawArrow(ctx, cx - dist + 40 * scale, cy, cx + dist - 40 * scale, cy, '#ffff88', scale);
        drawLabel(ctx, cx, cy - 130 * scale, '서로 접근하는 Na와 Cl', '#cce0ff', scale);
      } else if (phase < 2) {
        // 단계2: 전자 이동 (Na의 3s 전자가 Cl로)
        const progress = easeInOut(phase - 1);
        const dist = 100 * scale;
        const eX = cx - dist + (2 * dist) * progress; // 전자 이동 위치
        const eY = cy;
        drawNaAtom(ctx, cx - dist, cy, scale, progress);
        drawClAtom(ctx, cx + dist, cy, scale, progress);
        drawElectronShells(ctx, cx - dist, cy, scale, 11, progress);
        drawElectronShells(ctx, cx + dist, cy, scale, 17, progress);

        // 이동하는 전자
        ctx.beginPath();
        ctx.arc(eX, eY - 30 * scale, 7 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 10 * scale;
        ctx.fill();
        ctx.shadowBlur = 0;

        drawLabel(ctx, cx, cy - 130 * scale, 'Na의 전자가 Cl로 이동', '#ffd700', scale);
        drawLabel(ctx, cx, cy - 105 * scale, 'Na → Na⁺  /  Cl + e⁻ → Cl⁻', '#ffb347', scale);
      } else {
        // 단계3: 이온결합 완성 (Na⁺ - Cl⁻)
        const dist = 85 * scale;
        drawNaIon(ctx, cx - dist, cy, scale);
        drawClIon(ctx, cx + dist, cy, scale);
        drawIonicBond(ctx, cx - dist, cy, cx + dist, cy, scale, tRef.current);
        drawLabel(ctx, cx, cy - 130 * scale, 'Na⁺와 Cl⁻의 이온결합 형성', '#aaffaa', scale);
        drawLabel(ctx, cx, cy - 105 * scale, '정전기적 인력으로 결합 유지', '#88ff88', scale);
      }

      drawLegend(ctx, W, H, scale);
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

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawNaAtom(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, progress: number) {
  const r = 32 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#e0b0ff');
  grad.addColorStop(1, '#7b2fbe');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${14 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(progress > 0.7 ? 'Na⁺' : 'Na', x, y);
}

function drawNaIon(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = 28 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#e0b0ff');
  grad.addColorStop(1, '#6a0dad');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = '#cc88ff';
  ctx.shadowBlur = 15 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${15 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Na⁺', x, y);
}

function drawClAtom(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, progress: number) {
  const r = 34 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#90ff90');
  grad.addColorStop(1, '#1a8a1a');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${14 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(progress > 0.7 ? 'Cl⁻' : 'Cl', x, y);
}

function drawClIon(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = 38 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#aaffaa');
  grad.addColorStop(1, '#0a6b0a');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = '#66ff66';
  ctx.shadowBlur = 15 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${15 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Cl⁻', x, y);
}

function drawElectronShells(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  atomicNum: number,
  progress: number
) {
  // Na(11): 2,8,1  /  Cl(17): 2,8,7
  const shells = atomicNum === 11 ? [2, 8, 1] : [2, 8, 7];
  const radii = [50, 75, 100].map((r) => r * scale);

  shells.forEach((count, i) => {
    const adjustedCount = atomicNum === 11 && i === 2
      ? Math.max(0, count - Math.round(progress))
      : atomicNum === 17 && i === 2
      ? Math.min(8, count + Math.round(progress))
      : count;

    ctx.beginPath();
    ctx.arc(x, y, radii[i], 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,160,255,0.2)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    for (let j = 0; j < adjustedCount; j++) {
      const angle = (j / adjustedCount) * Math.PI * 2 - Math.PI / 2;
      const ex = x + Math.cos(angle) * radii[i];
      const ey = y + Math.sin(angle) * radii[i];
      ctx.beginPath();
      ctx.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = i === 2 && atomicNum === 11 ? '#ff8888' : '#88ccff';
      ctx.fill();
    }
  });
}

function drawIonicBond(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  scale: number,
  t: number
) {
  ctx.setLineDash([8 * scale, 5 * scale]);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 인력 화살표 (양방향 떨림)
  const wobble = Math.sin(t * 4) * 3 * scale;
  drawArrow(ctx, x1 + 40 * scale, y1 + wobble, x2 - 40 * scale, y2 + wobble, '#ffd700', scale);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  scale: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 12 * scale;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * headLen + uy * headLen * 0.5, y2 - uy * headLen - ux * headLen * 0.5);
  ctx.lineTo(x2 - ux * headLen - uy * headLen * 0.5, y2 - uy * headLen + ux * headLen * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string,
  color: string,
  scale: number
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawStageLabel(
  ctx: CanvasRenderingContext2D,
  phase: number,
  W: number,
  scale: number
) {
  const stages = ['① 접근', '② 전자 이동', '③ 이온결합'];
  const idx = Math.min(2, Math.floor(phase));
  ctx.fillStyle = '#1a2a4a';
  ctx.roundRect(W / 2 - 60 * scale, 12 * scale, 120 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(stages[idx], W / 2, 26 * scale);
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scale: number
) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce0ff';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'NaCl 이온결합: Na의 전자 1개가 Cl로 이동 → Na⁺, Cl⁻ 생성 → 정전기적 인력으로 결합',
    W / 2,
    H - 35 * scale
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
