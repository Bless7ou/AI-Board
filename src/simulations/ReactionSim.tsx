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

      switch (reactionType) {
        case 'combustion':
          drawCombustionReaction(ctx, cx, cy, W, H, scale, phase, t);
          break;
        case 'neutralization':
          drawNeutralizationEquation(ctx, cx, cy, W, H, scale, phase, t);
          break;
        case 'synthesis':
          drawSynthesisReaction(ctx, cx, cy, W, H, scale, phase, t, equation);
          break;
        case 'decomposition':
          drawDecompositionReaction(ctx, cx, cy, W, H, scale, phase, t, equation);
          break;
        case 'redox':
          drawRedoxReaction(ctx, cx, cy, W, H, scale, phase, t, equation);
          break;
        case 'double_displacement':
          drawDoubleDisplacementReaction(ctx, cx, cy, W, H, scale, phase, t, equation);
          break;
        default:
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

// ─────────────────────────────────────────────────────────────────────────────
// 합성 반응 (N₂ + 3H₂ → 2NH₃)
// ─────────────────────────────────────────────────────────────────────────────
function drawSynthesisReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number, equation: string
) {
  const parts = equation.split(/[→>]/);
  const reactantStr = parts[0]?.trim() ?? 'A + B';
  const productStr = parts[1]?.trim() ?? 'C';
  const reactants = reactantStr.split('+').map(s => s.trim()).filter(Boolean);

  if (phase < 1) {
    const progress = easeInOut(phase);
    const positions = getReactantPositions(reactants.length, cx, cy, scale, progress);
    reactants.forEach((mol, i) => {
      const { x, y } = positions[i];
      const color = MOL_COLORS[i % MOL_COLORS.length];
      drawMolLabel(ctx, x, y, mol, color, scale, t + i * 0.5);
      if (i < reactants.length - 1) {
        const nx = positions[i + 1].x;
        drawPlus(ctx, (x + nx) / 2, y, scale);
      }
    });
    positions.forEach(({ x, y }) => {
      if (Math.abs(x - cx) > 20 * scale) {
        const dir = x < cx ? 1 : -1;
        drawSmallArrow(ctx, x + dir * 30 * scale, y, dir, scale, '#ffd70066');
      }
    });
    drawLabel(ctx, cx, cy - 120 * scale, '반응물이 서로 접근 중', '#aaddff', scale);

  } else if (phase < 2) {
    const p = phase - 1;
    const glowR = (30 + p * 50) * scale;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, 'rgba(255,220,50,0.8)');
    glow.addColorStop(0.5, 'rgba(255,140,0,0.4)');
    glow.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + t * 4;
      const r = 30 * scale * p;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = MOL_COLORS[i % MOL_COLORS.length];
      ctx.fill();
    }
    reactants.forEach((mol, i) => {
      const basePos = getReactantPositions(reactants.length, cx, cy, scale, 1)[i];
      const x = basePos.x + (cx - basePos.x) * p;
      const y = basePos.y + (cy - basePos.y) * p;
      ctx.globalAlpha = 1 - p * 0.8;
      drawMolLabel(ctx, x, y, mol, MOL_COLORS[i % MOL_COLORS.length], scale * (1 - p * 0.3), t);
      ctx.globalAlpha = 1;
    });
    drawLabel(ctx, cx, cy - 120 * scale, '결합 형성 — 에너지 방출', '#ffd700', scale);

  } else {
    const p = easeInOut(phase - 2);
    const products = productStr.split('+').map(s => s.trim()).filter(Boolean);
    const prodPositions = getProductPositions(products.length, cx, cy, scale, p);
    products.forEach((mol, i) => {
      const { x, y } = prodPositions[i];
      const color = PROD_COLORS[i % PROD_COLORS.length];
      drawMolLabel(ctx, x, y, mol, color, scale * (0.8 + p * 0.3), t + i * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, (40 + Math.sin(t * 2) * 5) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = color + '44';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    });
    drawLabel(ctx, cx, cy - 120 * scale, `${productStr} 생성 완료!`, '#aaffaa', scale);
  }

  drawEquationBox(ctx, equation, W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물 접근', '② 결합 형성', '③ 생성물']);
}

// ─────────────────────────────────────────────────────────────────────────────
// 분해 반응 (2H₂O → 2H₂ + O₂)
// ─────────────────────────────────────────────────────────────────────────────
function drawDecompositionReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number, equation: string
) {
  const parts = equation.split(/[→>]/);
  const reactantStr = parts[0]?.trim() ?? 'A';
  const productStr = parts[1]?.trim() ?? 'B + C';
  const products = productStr.split('+').map(s => s.trim()).filter(Boolean);

  if (phase < 1) {
    drawMolLabel(ctx, cx, cy, reactantStr, '#aaccff', scale * 1.2, t);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const r1 = 35 * scale * 1.2;
      const r2 = 50 * scale * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.strokeStyle = '#aaccff66';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    }
    drawLabel(ctx, cx, cy - 120 * scale, '안정한 분자 상태', '#aaddff', scale);

  } else if (phase < 2) {
    const p = phase - 1;
    const vibration = Math.sin(t * (8 + p * 12)) * p * 12 * scale;
    const vibrationY = Math.cos(t * (7 + p * 10)) * p * 8 * scale;
    drawEnergyInput(ctx, cx, cy, scale, t, p);
    drawMolLabel(ctx, cx + vibration, cy + vibrationY, reactantStr, '#ff8888', scale * 1.2, t);
    if (p > 0.5) {
      const crackP = (p - 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 35 * scale);
      ctx.lineTo(cx + crackP * 30 * scale, cy);
      ctx.lineTo(cx - crackP * 20 * scale, cy + 35 * scale);
      ctx.strokeStyle = `rgba(255,100,50,${crackP * 0.8})`;
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    }
    drawLabel(ctx, cx, cy - 120 * scale, '에너지 흡수 → 결합 분해 중!', '#ffd700', scale);

  } else {
    const p = easeInOut(phase - 2);
    const spread = p * 130 * scale;
    products.forEach((mol, i) => {
      const total = products.length;
      const angle = ((i / total) - 0.5) * Math.PI * 1.2;
      const x = cx + Math.sin(angle) * spread;
      const y = cy - Math.cos(angle) * spread * 0.5;
      const color = PROD_COLORS[i % PROD_COLORS.length];
      drawMolLabel(ctx, x, y, mol, color, scale, t + i * 0.5);
      if (p > 0.3) {
        const vx = Math.sin(angle) * 25 * scale;
        const vy = -Math.cos(angle) * 12 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx, y + vy);
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
      }
    });
    drawLabel(ctx, cx, cy - 120 * scale, '분해 완료 — 생성물 분리!', '#aaffaa', scale);
  }

  drawEquationBox(ctx, equation, W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 안정한 분자', '② 에너지 흡수', '③ 분해 생성물']);
}

// ─────────────────────────────────────────────────────────────────────────────
// 산화환원 반응 (Zn + CuSO₄ → ZnSO₄ + Cu)
// ─────────────────────────────────────────────────────────────────────────────
function drawRedoxReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number, equation: string
) {
  const parts = equation.split(/[→>]/);
  const reactantStr = parts[0]?.trim() ?? 'Zn + CuSO₄';
  const reactants = reactantStr.split('+').map(s => s.trim()).filter(Boolean);
  const productStr = parts[1]?.trim() ?? 'ZnSO₄ + Cu';
  const leftX = cx - 130 * scale;
  const rightX = cx + 130 * scale;

  if (phase < 1) {
    const r0 = reactants[0] ?? 'Zn';
    const r1 = reactants[1] ?? 'Cu²⁺';
    drawMolLabel(ctx, leftX, cy, r0, '#88ff88', scale, t);
    drawMolLabel(ctx, rightX, cy, r1, '#ffaa44', scale, t + 0.5);
    drawPlus(ctx, cx, cy, scale);
    drawOxidationLabel(ctx, leftX, cy - 60 * scale, '산화수: 0', '#88ff88', scale);
    drawOxidationLabel(ctx, rightX, cy - 60 * scale, '산화수: +2', '#ffaa44', scale);
    drawLabel(ctx, leftX, cy + 70 * scale, '환원제 (산화됨)', '#88ff88', scale * 0.85);
    drawLabel(ctx, rightX, cy + 70 * scale, '산화제 (환원됨)', '#ffaa44', scale * 0.85);
    drawLabel(ctx, cx, cy - 110 * scale, '전자 이동 시작 전', '#aaddff', scale);

  } else if (phase < 2) {
    const p = phase - 1;
    const r0 = reactants[0] ?? 'Zn';
    const r1 = reactants[1] ?? 'Cu²⁺';
    drawMolLabel(ctx, leftX, cy, r0, '#ffff44', scale, t);
    drawMolLabel(ctx, rightX, cy, r1, '#ff8844', scale, t + 0.5);
    const electronCount = 3;
    for (let i = 0; i < electronCount; i++) {
      const offset = (i / electronCount);
      const progress = ((t * 0.8 + offset) % 1);
      const ex = leftX + (rightX - leftX) * progress;
      const ey = cy + Math.sin(progress * Math.PI * 2) * 30 * scale;
      ctx.beginPath();
      ctx.arc(ex, ey, 7 * scale, 0, Math.PI * 2);
      const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 7 * scale);
      eGrad.addColorStop(0, '#aaaaff');
      eGrad.addColorStop(0.5, '#4444ff');
      eGrad.addColorStop(1, 'rgba(0,0,100,0)');
      ctx.fillStyle = eGrad;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${8 * scale}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('e⁻', ex, ey);
    }
    ctx.beginPath();
    ctx.setLineDash([5 * scale, 5 * scale]);
    ctx.moveTo(leftX + 35 * scale, cy);
    ctx.lineTo(rightX - 35 * scale, cy);
    ctx.strokeStyle = 'rgba(100,100,255,0.3)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.setLineDash([]);
    const oxLeft = 0 + p * 2;
    const oxRight = 2 - p * 2;
    drawOxidationLabel(ctx, leftX, cy - 60 * scale, `산화수: +${oxLeft.toFixed(1)}↑`, '#ffff44', scale);
    drawOxidationLabel(ctx, rightX, cy - 60 * scale, `산화수: +${oxRight.toFixed(1)}↓`, '#ffaa44', scale);
    drawLabel(ctx, cx, cy - 110 * scale, '전자(e⁻) 이동 중 — 산화환원 반응!', '#ffd700', scale);

  } else {
    const products = productStr.split('+').map(s => s.trim()).filter(Boolean);
    const p0 = products[0] ?? 'Zn²⁺';
    const p1 = products[1] ?? 'Cu';
    drawMolLabel(ctx, leftX, cy, p0, '#ffff44', scale, t);
    drawMolLabel(ctx, rightX, cy, p1, '#ff9900', scale, t + 0.5);
    drawPlus(ctx, cx, cy, scale);
    drawOxidationLabel(ctx, leftX, cy - 60 * scale, '산화수: +2 (산화됨)', '#ffff44', scale);
    drawOxidationLabel(ctx, rightX, cy - 60 * scale, '산화수: 0 (환원됨)', '#ff9900', scale);
    for (let i = 1; i <= 3; i++) {
      const r = (38 + i * 15 + (t * 15) % 45) * scale;
      ctx.beginPath();
      ctx.arc(rightX, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,150,0,${0.4 - i * 0.1})`;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
    }
    drawLabel(ctx, leftX, cy + 70 * scale, '산화 완료', '#ffff44', scale * 0.85);
    drawLabel(ctx, rightX, cy + 70 * scale, '환원 완료', '#ff9900', scale * 0.85);
    drawLabel(ctx, cx, cy - 110 * scale, '산화환원 반응 완료!', '#aaffaa', scale);
  }

  drawEquationBox(ctx, equation || 'Zn + CuSO₄ → ZnSO₄ + Cu  (산화환원)', W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물', '② 전자 이동', '③ 생성물']);
}

// ─────────────────────────────────────────────────────────────────────────────
// 이중치환 반응 (AgNO₃ + NaCl → AgCl↓ + NaNO₃)
// ─────────────────────────────────────────────────────────────────────────────
function drawDoubleDisplacementReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number, equation: string
) {
  const parts = equation.split(/[→>]/);
  const reactantStr = parts[0]?.trim() ?? 'AgNO₃ + NaCl';
  const productStr = parts[1]?.trim() ?? 'AgCl + NaNO₃';
  const reactants = reactantStr.split('+').map(s => s.trim()).filter(Boolean);
  const products = productStr.split('+').map(s => s.trim()).filter(Boolean);

  if (phase < 1) {
    const p = easeInOut(phase);
    const lx = cx - 120 * scale + 30 * scale * p;
    const rx = cx + 120 * scale - 30 * scale * p;
    drawMolLabel(ctx, lx, cy, reactants[0] ?? 'AgNO₃', '#aaeeaa', scale, t);
    drawMolLabel(ctx, rx, cy, reactants[1] ?? 'NaCl', '#aaaaee', scale, t + 0.5);
    drawPlus(ctx, cx, cy, scale);
    drawLabel(ctx, cx, cy - 110 * scale, '두 화합물이 용액에서 반응', '#aaddff', scale);

  } else if (phase < 2) {
    const p = phase - 1;
    const lx = cx - 120 * scale;
    const rx = cx + 120 * scale;
    const ion1x = lx + (rx - lx) * p * 0.8;
    const ion2x = rx - (rx - lx) * p * 0.8;
    const ion1y = cy - 20 * scale * Math.sin(p * Math.PI);
    const ion2y = cy + 20 * scale * Math.sin(p * Math.PI);
    ctx.beginPath();
    ctx.arc(ion1x, ion1y, 18 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,255,200,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#aaeeaa';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.fillStyle = '#aaeeaa';
    ctx.font = `bold ${11 * scale}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ag⁺', ion1x, ion1y);
    ctx.beginPath();
    ctx.arc(ion2x, ion2y, 18 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#aaaaee';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.fillStyle = '#aaaaee';
    ctx.fillText('Cl⁻', ion2x, ion2y);
    drawLabel(ctx, cx, cy - 110 * scale, '이온 교환 반응 진행 중', '#ffd700', scale);

  } else {
    drawMolLabel(ctx, cx - 80 * scale, cy - 30 * scale, products[0] ?? 'AgCl↓', '#ffffff', scale, t);
    drawMolLabel(ctx, cx + 80 * scale, cy - 30 * scale, products[1] ?? 'NaNO₃', '#88aaff', scale, t + 0.5);
    for (let i = 0; i < 8; i++) {
      const px = cx - 80 * scale + (i - 4) * 8 * scale;
      const py = cy + 20 * scale + (t * 20 + i * 15) % (60 * scale);
      ctx.beginPath();
      ctx.arc(px, py, 3 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    }
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${11 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('↓ 침전물 생성', cx - 80 * scale, cy + 80 * scale);
    drawLabel(ctx, cx, cy - 110 * scale, '이중치환 완료 — 앙금 생성!', '#aaffaa', scale);
  }

  drawEquationBox(ctx, equation, W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물', '② 이온 교환', '③ 생성물 (침전)']);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

const MOL_COLORS = ['#aaccff', '#ffaacc', '#aaffcc', '#ffddaa', '#ccaaff'];
const PROD_COLORS = ['#66ffaa', '#aaffff', '#ffcc66', '#ff88cc', '#88ffdd'];

function drawOxidationLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, text: string, color: string, scale: number
) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const w = text.length * 7 * scale;
  ctx.roundRect(x - w / 2, y - 10 * scale, w, 22 * scale, 4 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `bold ${11 * scale}px sans-serif`;
  ctx.fillText(text, x, y + 1 * scale);
}

function drawSmallArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, dir: number, scale: number, color: string
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * 15 * scale, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dir * 15 * scale, y);
  ctx.lineTo(x + dir * 8 * scale, y - 5 * scale);
  ctx.lineTo(x + dir * 8 * scale, y + 5 * scale);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawEnergyInput(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, t: number, intensity: number
) {
  if (Math.sin(t * 8) > 0.3) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,0,${intensity * 0.9})`;
    ctx.lineWidth = 3 * scale;
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    const bx = cx - 80 * scale;
    const by = cy - 100 * scale;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 15 * scale, by + 40 * scale);
    ctx.lineTo(bx - 5 * scale, by + 40 * scale);
    ctx.lineTo(bx + 10 * scale, by + 80 * scale);
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 1; i <= 3; i++) {
    const r = (20 + i * 25 + (t * 40) % 75) * scale * intensity;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,100,0,${(0.5 - i * 0.1) * intensity})`;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(255,200,0,${intensity * 0.7})`;
  ctx.font = `bold ${14 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡ 에너지 투입', cx + 60 * scale, cy - 90 * scale);
}

function getReactantPositions(
  count: number, cx: number, cy: number, scale: number, progress: number
): { x: number; y: number }[] {
  const spread = 1 - progress * 0.6;
  const spacing = 120 * scale;
  return Array.from({ length: count }, (_, i) => ({
    x: cx + (i - (count - 1) / 2) * spacing * spread,
    y: cy,
  }));
}

function getProductPositions(
  count: number, cx: number, cy: number, scale: number, progress: number
): { x: number; y: number }[] {
  const spacing = 110 * scale * progress;
  return Array.from({ length: count }, (_, i) => ({
    x: cx + (i - (count - 1) / 2) * spacing,
    y: cy,
  }));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
