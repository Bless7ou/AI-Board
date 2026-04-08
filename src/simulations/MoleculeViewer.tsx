import { useEffect, useRef } from 'react';
import type { MoleculeData, Bond } from '../chemistry/types';
import { ATOMS } from '../chemistry/atomData';

interface Props {
  molecule: MoleculeData;
  playing: boolean;
  speed: number;
}

export default function MoleculeViewer({ molecule, playing, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const angleRef = useRef(0);
  const pulseRef = useRef(0);

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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 - 30;
      const scale = Math.min(canvas.width, canvas.height) / 420;

      if (playing) {
        angleRef.current += 0.008 * speed;
        pulseRef.current += 0.04 * speed;
      }

      const angle = angleRef.current;
      const pulse = Math.sin(pulseRef.current) * 0.06 + 1;

      // 원자 위치 계산 (중심 기준 오프셋 + 회전)
      const atomPositions = molecule.atoms.map((a) => {
        const ox = (a.x - 200) * scale * pulse;
        const oy = (a.y - 180) * scale * pulse;
        return {
          x: cx + ox * Math.cos(angle) - oy * Math.sin(angle * 0.3),
          y: cy + oy + ox * Math.sin(angle) * 0.2,
          symbol: a.symbol,
        };
      });

      // 결합 그리기
      molecule.bonds.forEach((bond) => {
        drawBond(ctx, atomPositions[bond.from], atomPositions[bond.to], bond, scale, pulseRef.current);
      });

      // 원자 개수에 따라 반지름/라벨 조정
      const atomCount = molecule.atoms.length;
      const radiusScale = atomCount <= 4 ? 1 : Math.max(0.45, 1 - (atomCount - 4) * 0.055);
      const showName = atomCount <= 5;

      // 원자 그리기
      atomPositions.forEach((pos) => {
        drawAtom(ctx, pos.x, pos.y, pos.symbol, scale, radiusScale, showName);
      });

      // 분자 정보
      drawInfo(ctx, molecule, canvas.width, canvas.height);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [molecule, playing, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

function drawAtom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  symbol: string,
  scale: number,
  radiusScale = 1,
  showName = true,
) {
  const atom = ATOMS[symbol];
  const r = (atom?.radius ?? 28) * scale * 0.85 * radiusScale;
  const color = atom?.color ?? '#aaaaaa';

  // 그림자 (원자 수 많을 때 블러 줄임)
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * scale * radiusScale;

  // 원
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, lighten(color, 60));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darken(color, 40));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 테두리
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 원소 기호
  ctx.fillStyle = isLight(color) ? '#111' : '#fff';
  ctx.font = `bold ${Math.max(11, r * 0.75)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, y);

  // 원소 이름 (원자 수 적을 때만 표시)
  const name = ATOMS[symbol]?.name ?? '';
  if (showName && name) {
    ctx.fillStyle = 'rgba(200,220,255,0.7)';
    ctx.font = `${Math.max(8, r * 0.42)}px sans-serif`;
    ctx.fillText(name, x, y + r + 12 * scale);
  }
}

function drawBond(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  bond: Bond,
  scale: number,
  pulse: number
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const offset = 5 * scale;

  if (bond.type === 'ionic') {
    // 이온결합: 점선 + 전하 표시
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 전자 이동 애니메이션
    const t = (Math.sin(pulse) + 1) / 2;
    const ex = from.x + dx * t;
    const ey = from.y + dy * t;
    ctx.beginPath();
    ctx.arc(ex, ey, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b6b';
    ctx.fill();
    return;
  }

  ctx.setLineDash([]);
  const count = bond.type === 'triple' ? 3 : bond.type === 'double' ? 2 : 1;
  const offsets = count === 1 ? [0] : count === 2 ? [-offset, offset] : [-offset * 1.4, 0, offset * 1.4];

  offsets.forEach((off) => {
    ctx.beginPath();
    ctx.moveTo(from.x + nx * off, from.y + ny * off);
    ctx.lineTo(to.x + nx * off, to.y + ny * off);
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.85)';
    ctx.lineWidth = 3 * scale;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
}

function drawInfo(
  ctx: CanvasRenderingContext2D,
  mol: MoleculeData,
  w: number,
  h: number
) {
  const pad = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.roundRect(pad, h - 80, w - pad * 2, 68, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e8f4ff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${mol.formula}  ${mol.name}`, pad + 10, h - 72);

  ctx.fillStyle = '#a0c4ff';
  ctx.font = '13px sans-serif';
  const details = [
    mol.shape ? `구조: ${mol.shape}` : '',
    mol.polarity ? `극성: ${mol.polarity === 'polar' ? '극성 분자' : '무극성 분자'}` : '',
  ].filter(Boolean).join('   ');
  ctx.fillText(details, pad + 10, h - 50);
}

// 색상 유틸
function lighten(hex: string, amt: number): string {
  const rgb = hexToRgb(hex);
  return `rgb(${Math.min(255, rgb[0] + amt)},${Math.min(255, rgb[1] + amt)},${Math.min(255, rgb[2] + amt)})`;
}
function darken(hex: string, amt: number): string {
  const rgb = hexToRgb(hex);
  return `rgb(${Math.max(0, rgb[0] - amt)},${Math.max(0, rgb[1] - amt)},${Math.max(0, rgb[2] - amt)})`;
}
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
}
