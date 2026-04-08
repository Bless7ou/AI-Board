import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  speed: number;
}

// H₂O 공유결합 형성 시뮬레이션
export default function CovalentBondSim({ playing, speed }: Props) {
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
      const phase = t % 2; // 0~1: 접근/결합, 1~2: 유지

      const scale = Math.min(W, H) / 500;
      const cx = W / 2;
      const cy = H / 2 - 10 * scale;

      drawBg(ctx, W, H);
      drawTitle(ctx, phase, W, scale);

      if (phase < 1) {
        const p = easeInOut(phase);
        // O와 2개의 H가 접근
        const oX = cx;
        const oY = cy;
        const dist = 140 * scale * (1 - p * 0.55);
        const h1X = cx - dist * Math.cos(Math.PI / 6);
        const h1Y = cy + dist * Math.sin(Math.PI / 6);
        const h2X = cx + dist * Math.cos(Math.PI / 6);
        const h2Y = cy + dist * Math.sin(Math.PI / 6);

        drawOAtom(ctx, oX, oY, scale, p);
        drawHAtom(ctx, h1X, h1Y, scale, p, 'H');
        drawHAtom(ctx, h2X, h2Y, scale, p, 'H');
        drawElectronDots(ctx, oX, oY, scale, 6, p);
        drawElectronDots(ctx, h1X, h1Y, scale, 1, p);
        drawElectronDots(ctx, h2X, h2Y, scale, 1, p);

        if (p > 0.4) {
          drawSharedElectrons(ctx, oX, oY, h1X, h1Y, scale, p, t);
          drawSharedElectrons(ctx, oX, oY, h2X, h2Y, scale, p, t);
        }

        drawLabel(ctx, cx, cy - 140 * scale, `원자 접근 → 전자쌍 공유 형성 중`, '#aaddff', scale);
      } else {
        // H2O 완성 구조
        const oX = cx;
        const oY = cy - 20 * scale;
        const angle = 52 * (Math.PI / 180); // 104.5° / 2
        const bondLen = 75 * scale;
        const h1X = oX - Math.sin(angle) * bondLen;
        const h1Y = oY + Math.cos(angle) * bondLen;
        const h2X = oX + Math.sin(angle) * bondLen;
        const h2Y = oY + Math.cos(angle) * bondLen;

        // 결합 그리기
        drawBond(ctx, oX, oY, h1X, h1Y, scale);
        drawBond(ctx, oX, oY, h2X, h2Y, scale);

        drawOAtom(ctx, oX, oY, scale, 1);
        drawHAtom(ctx, h1X, h1Y, scale, 1, 'H');
        drawHAtom(ctx, h2X, h2Y, scale, 1, 'H');

        // 비공유전자쌍
        drawLonePairs(ctx, oX, oY, scale, t);

        // 극성 화살표
        drawPolarityArrow(ctx, oX, oY, scale, t);

        drawLabel(ctx, cx, cy - 140 * scale, 'H₂O: 굽은형 구조 (104.5°)', '#aaffaa', scale);
        drawLabel(ctx, cx, cy - 115 * scale, '극성 공유결합 | 비공유전자쌍 2쌍', '#88ff88', scale);
        drawAngleLabel(ctx, oX, oY, h1X, h1Y, h2X, h2Y, scale);
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

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawOAtom(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, _p: number) {
  const r = 32 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ff8888');
  grad.addColorStop(1, '#cc0000');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 10 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${15 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('O', x, y);
}

function drawHAtom(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, _p: number, label: string) {
  const r = 20 * scale;
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#aaaaaa');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = '#cccccc';
  ctx.shadowBlur = 6 * scale;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#222';
  ctx.font = `bold ${13 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function drawElectronDots(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  valence: number,
  progress: number
) {
  const count = Math.floor(valence * (1 - progress * 0.5));
  const r = 45 * scale;
  for (let i = 0; i < count; i++) {
    const angle = (i / valence) * Math.PI * 2;
    const ex = x + Math.cos(angle) * r;
    const ey = y + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#88ccff';
    ctx.fill();
  }
}

function drawSharedElectrons(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  scale: number,
  progress: number,
  t: number
) {
  const midX = x1 + (x2 - x1) * 0.5;
  const midY = y1 + (y2 - y1) * 0.5;
  const wobble = Math.sin(t * 5) * 5 * scale;
  const opacity = Math.min(1, progress * 2);

  // 공유 전자쌍 (2개)
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(midX + s * 8 * scale * progress, midY + wobble, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 220, 80, ${opacity})`;
    ctx.shadowColor = '#ffdd55';
    ctx.shadowBlur = 8 * scale;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // 결합선
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(150, 200, 255, ${opacity * 0.7})`;
  ctx.lineWidth = 3 * scale;
  ctx.stroke();
}

function drawBond(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  scale: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(150, 200, 255, 0.8)';
  ctx.lineWidth = 4 * scale;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawLonePairs(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number, t: number
) {
  // 비공유전자쌍 2쌍 (O 위쪽 좌우)
  const pairs = [
    { angle: -Math.PI * 0.65, label: '비공유\n전자쌍' },
    { angle: -Math.PI * 0.35, label: '' },
  ];
  pairs.forEach(({ angle }) => {
    const r = 42 * scale;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    const wobble = Math.sin(t * 3 + angle) * 2 * scale;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(px + s * 6 * scale, py + wobble, 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9966';
      ctx.shadowColor = '#ff9966';
      ctx.shadowBlur = 6 * scale;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  });

  // 레이블
  ctx.fillStyle = '#ff9966';
  ctx.font = `${10 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('비공유 전자쌍 2쌍', x, y - 45 * scale);
}

function drawPolarityArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number, _t: number
) {
  // δ- 표시 (O 쪽)
  ctx.fillStyle = '#ff6666';
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('δ−', x, y - 50 * scale);

  // δ+ 표시 (H 쪽은 legend에서)
}

function drawAngleLabel(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  h1x: number, h1y: number,
  h2x: number, h2y: number,
  scale: number
) {
  const midX = (h1x + h2x) / 2;
  const midY = (h1y + h2y) / 2;
  // 각도 호
  ctx.beginPath();
  ctx.arc(ox, oy, 30 * scale, Math.atan2(h1y - oy, h1x - ox), Math.atan2(h2y - oy, h2x - ox));
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
  ctx.fillStyle = '#ffff88';
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('104.5°', midX, midY + 5 * scale);
}

function drawTitle(ctx: CanvasRenderingContext2D, phase: number, W: number, scale: number) {
  const label = phase < 1 ? '① 공유결합 형성 과정' : '② H₂O 분자 완성';
  ctx.fillStyle = '#1a2a4a';
  ctx.roundRect(W / 2 - 80 * scale, 12 * scale, 160 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff';
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(label, W / 2, 26 * scale);
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  text: string, color: string, scale: number
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawLegend(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce0ff';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    '공유결합: 각 원자가 전자쌍을 공유 | H₂O는 굽은형(104.5°) | 극성 분자',
    W / 2, H - 35 * scale
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
