import { useEffect, useRef, useState, useCallback } from 'react';
import MiniCanvas from '../components/MiniCanvas';
import { parseChemistry } from '../chemistry/parser';

interface Props {
  equation: string;
  reactionType: string;
  playing: boolean;
  speed: number;
}

const PRESETS_BY_TYPE: Record<string, { label: string; equation: string }[]> = {
  synthesis: [
    { label: 'N₂ + 3H₂ → 2NH₃',       equation: 'N₂ + 3H₂ → 2NH₃' },
    { label: '2Na + Cl₂ → 2NaCl',      equation: '2Na + Cl₂ → 2NaCl' },
    { label: '2Mg + O₂ → 2MgO',        equation: '2Mg + O₂ → 2MgO' },
    { label: 'CaO + H₂O → Ca(OH)₂',   equation: 'CaO + H₂O → Ca(OH)₂' },
  ],
  decomposition: [
    { label: '2H₂O → 2H₂ + O₂',       equation: '2H₂O → 2H₂ + O₂' },
    { label: '2KClO₃ → 2KCl + 3O₂',   equation: '2KClO₃ → 2KCl + 3O₂' },
    { label: 'CaCO₃ → CaO + CO₂',     equation: 'CaCO₃ → CaO + CO₂' },
  ],
  combustion: [
    { label: '2H₂ + O₂ → 2H₂O',       equation: '2H₂ + O₂ → 2H₂O' },
    { label: 'CH₄ + 2O₂ → CO₂ + 2H₂O', equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O' },
    { label: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O', equation: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O' },
  ],
  neutralization: [
    { label: 'HCl + NaOH → NaCl + H₂O',     equation: 'HCl + NaOH → NaCl + H₂O' },
    { label: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O', equation: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O' },
    { label: 'HNO₃ + KOH → KNO₃ + H₂O',     equation: 'HNO₃ + KOH → KNO₃ + H₂O' },
  ],
  redox: [
    { label: 'Zn + CuSO₄ → ZnSO₄ + Cu',     equation: 'Zn + CuSO₄ → ZnSO₄ + Cu' },
    { label: 'Fe + CuSO₄ → FeSO₄ + Cu',      equation: 'Fe + CuSO₄ → FeSO₄ + Cu' },
    { label: 'Mg + 2HCl → MgCl₂ + H₂',       equation: 'Mg + 2HCl → MgCl₂ + H₂' },
  ],
  double_displacement: [
    { label: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃', equation: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃' },
    { label: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl', equation: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl' },
    { label: 'Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃', equation: 'Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃' },
  ],
};

// 연소 반응 (2H₂ + O₂ → 2H₂O) 시뮬레이션
export default function ReactionSim({ equation: initEq, reactionType: initType, playing, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  const [equation, setEquation] = useState(initEq);
  const [reactionType, setReactionType] = useState(initType);
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => { setEquation(initEq); setReactionType(initType); }, [initEq, initType]);

  const handleSelect = useCallback((eq: string, type: string) => {
    setEquation(eq);
    setReactionType(type);
    setShowPicker(false);
    setInputError('');
    tRef.current = 0;
  }, []);

  const handleMiniRecognize = useCallback((text: string) => {
    const result = parseChemistry(text);
    if (result.type === 'reaction' && result.reaction) {
      handleSelect(result.reaction.equation, result.reaction.type);
    } else if (text.includes('→') || text.includes('->') || text.includes('>')) {
      handleSelect(text, 'synthesis');
    } else {
      setInputError(`"${text}" — 반응식을 인식할 수 없습니다`);
    }
  }, [handleSelect]);

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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* 반응식 선택 드롭다운 */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 5 }}>
        <button
          onClick={() => { setShowPicker(v => !v); setInputError(''); }}
          style={{
            background: showPicker ? 'rgba(60,120,255,0.4)' : 'rgba(10,20,50,0.7)',
            border: '1px solid rgba(80,150,255,0.4)',
            borderRadius: 8, padding: '4px 12px',
            color: '#aaccff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'background 0.15s',
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {equation.length > 20 ? equation.slice(0, 18) + '…' : equation} ▾
        </button>

        {showPicker && (
          <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
            <MiniCanvas
              onRecognize={handleMiniRecognize}
              onClose={() => { setShowPicker(false); setInputError(''); }}
              placeholder="반응식을 쓰세요 (예: 2H2+O2→2H2O)"
              width={230}
              height={90}
            />
            {inputError && (
              <div style={{ fontSize: 10, color: '#ff7766', textAlign: 'center', padding: '4px 0', marginTop: -4 }}>
                {inputError}
              </div>
            )}
            <div style={{
              marginTop: 6, padding: '6px 10px',
              background: 'rgba(8,14,30,0.95)',
              border: '1px solid rgba(60,120,240,0.25)',
              borderRadius: 10,
              display: 'flex', flexWrap: 'wrap', gap: 4,
              width: 250,
            }}>
              <div style={{ fontSize: 9, color: '#445566', width: '100%', marginBottom: 2 }}>또는 선택:</div>
              {(PRESETS_BY_TYPE[reactionType] ?? PRESETS_BY_TYPE['synthesis']).map((p: { label: string; equation: string }) => (
                <button
                  key={p.equation}
                  onClick={() => handleSelect(p.equation, reactionType)}
                  style={{
                    background: equation === p.equation ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                    border: `1px solid ${equation === p.equation ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                    borderRadius: 7, padding: '4px 8px',
                    color: equation === p.equation ? '#aaccff' : '#5577aa',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
  phase: number, t: number
) {
  const leftX = cx - 110 * scale;
  const rightX = cx + 110 * scale;

  if (phase < 1) {
    // ① 산과 염기 접근
    const p = easeInOut(phase);
    const drift = p * 30 * scale;
    drawMolLabel(ctx, leftX + drift, cy, 'HCl', '#ff8888', scale, t);
    drawMolLabel(ctx, rightX - drift, cy, 'NaOH', '#88aaff', scale, t + 0.5);
    drawPlus(ctx, cx, cy, scale);
    drawLabel(ctx, leftX + drift, cy + 55 * scale, '산 (H⁺ 공여)', '#ff8888', scale * 0.85);
    drawLabel(ctx, rightX - drift, cy + 55 * scale, '염기 (OH⁻ 공여)', '#88aaff', scale * 0.85);
    drawLabel(ctx, cx, cy - 100 * scale, '산과 염기가 만나는 중', '#aaddff', scale);

  } else if (phase < 2) {
    // ② 이온 반응 (H⁺ + OH⁻ → H₂O)
    const p = phase - 1;
    const ep = easeInOut(p);
    // H⁺ 와 OH⁻ 가 중앙으로 이동
    const hx = leftX + (cx - leftX) * ep;
    const ohx = rightX + (cx - rightX) * ep;
    drawMolLabel(ctx, hx, cy - 20 * scale, 'H⁺', '#ff6666', scale, t);
    drawMolLabel(ctx, ohx, cy + 20 * scale, 'OH⁻', '#6688ff', scale, t + 0.5);
    // 에너지 글로우
    if (ep > 0.5) {
      const gr = (20 + (ep - 0.5) * 60) * scale;
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      gg.addColorStop(0, `rgba(255,220,100,${(ep - 0.5) * 0.8})`);
      gg.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2);
      ctx.fillStyle = gg; ctx.fill();
    }
    drawLabel(ctx, cx, cy - 100 * scale, 'H⁺ + OH⁻ → H₂O  이온 반응 진행', '#ffd700', scale);

  } else {
    // ③ 생성물
    drawMolLabel(ctx, cx - 70 * scale, cy, 'NaCl', '#aaffaa', scale, t);
    drawMolLabel(ctx, cx + 70 * scale, cy, 'H₂O', '#66ccff', scale, t + 0.5);
    drawPlus(ctx, cx, cy, scale);
    drawLabel(ctx, cx - 70 * scale, cy + 55 * scale, '염', '#aaffaa', scale * 0.85);
    drawLabel(ctx, cx + 70 * scale, cy + 55 * scale, '물', '#66ccff', scale * 0.85);
    drawLabel(ctx, cx, cy - 100 * scale, '중화 반응 완료!', '#aaffaa', scale);
  }

  drawEquationBox(ctx, 'HCl + NaOH → NaCl + H₂O  (중화 반응)', W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 산 + 염기', '② 이온 반응', '③ 생성물']);
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
  const fontSize = 14 * scale;
  ctx.font = `bold ${fontSize}px sans-serif`;
  const textW = ctx.measureText(label).width;
  const r = Math.max(28 * scale, textW / 2 + 12 * scale);
  ctx.beginPath();
  ctx.arc(x, y + bob, r, 0, Math.PI * 2);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.fillStyle = color;
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
  x1: number, x2: number, y: number, scale: number, progress: number, _t: number
) {
  const hl = 12 * scale;
  const endX = x1 + (x2 - x1) * progress;
  // 화살표 줄기
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(endX, y);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();
  // 화살표 머리
  if (progress > 0.05) {
    ctx.beginPath();
    ctx.moveTo(endX, y);
    ctx.lineTo(endX - hl, y - hl * 0.5);
    ctx.lineTo(endX - hl, y + hl * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
  }
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
// 합성 반응 (N₂ + 3H₂ → 2NH₃)  — 고품질 원자 시각화
// ─────────────────────────────────────────────────────────────────────────────
function drawSynthesisReaction(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, scale: number,
  phase: number, t: number, equation: string
) {
  const isHaber = equation.includes('NH') && equation.includes('N');
  if (isHaber) {
    drawHaberSynthesis(ctx, cx, cy, W, H, scale, phase, t);
  } else {
    drawGenericSynthesisFallback(ctx, cx, cy, W, H, scale, phase, t, equation);
  }
  drawEquationBox(ctx, equation, W, H, scale);
  drawPhaseLabel(ctx, phase, W, scale, ['① 반응물 접근', '② 결합 형성', '③ 생성물']);
}

/* ── 하버법 특화 시각화 ── */
function drawHaberSynthesis(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, _W: number, _H: number, scale: number,
  phase: number, t: number
) {
  if (phase < 1) {
    /* ── Phase 1: 반응물 접근 ── */
    const p = easeInOut(phase);
    const drift = p * 30 * scale;

    // N₂
    const n2x = cx - 100 * scale + drift;
    const n2y = cy + Math.sin(t * 1.5) * 5 * scale;
    const nSep = 24 * scale;
    drawBondStick(ctx, n2x - nSep, n2y, n2x + nSep, n2y, scale, 3);
    drawGlossyAtom(ctx, n2x - nSep, n2y, 'N', scale);
    drawGlossyAtom(ctx, n2x + nSep, n2y, 'N', scale);
    ctx.fillStyle = '#8899cc'; ctx.font = `${11 * scale}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('N₂', n2x, n2y + 38 * scale);

    // 3 H₂
    const h2s = [
      { x: cx + 85 * scale - drift * 0.5, y: cy - 50 * scale },
      { x: cx + 115 * scale - drift * 0.7, y: cy + 5 * scale },
      { x: cx + 85 * scale - drift * 0.5, y: cy + 50 * scale },
    ];
    h2s.forEach((pos, i) => {
      const bob = Math.sin(t * 1.8 + i * 2.1) * 4 * scale;
      const hSep = 14 * scale;
      drawBondStick(ctx, pos.x - hSep, pos.y + bob, pos.x + hSep, pos.y + bob, scale, 1);
      drawGlossyAtom(ctx, pos.x - hSep, pos.y + bob, 'H', scale);
      drawGlossyAtom(ctx, pos.x + hSep, pos.y + bob, 'H', scale);
      ctx.fillStyle = '#9999bb'; ctx.font = `${11 * scale}px sans-serif`;
      ctx.textAlign = 'center'; ctx.fillText('H₂', pos.x, pos.y + bob + 28 * scale);
    });

    ctx.fillStyle = 'rgba(200,220,255,0.5)'; ctx.font = `bold ${16 * scale}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', cx - 15 * scale, cy);
    drawLabel(ctx, cx, cy - 110 * scale, '반응물이 서로 접근 중', '#aaddff', scale);

  } else if (phase < 2) {
    /* ── Phase 2: 결합 분해 → 재형성 ── */
    const p = phase - 1;
    const ep = easeInOut(p);

    // 에너지 글로우
    const gr = (40 + ep * 80) * scale;
    const pulse = 0.7 + Math.sin(t * 5) * 0.3;
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    gg.addColorStop(0, `rgba(255,210,50,${0.6 * pulse})`);
    gg.addColorStop(0.4, `rgba(255,120,0,${0.25 * pulse})`);
    gg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.fillStyle = gg; ctx.fill();

    // 스파크
    for (let i = 0; i < 15; i++) {
      const seed = i * 137.508;
      const angle = seed + t * 2.5;
      const r = ((seed * 7 + t * 35) % 90) * scale;
      const alpha = Math.max(0, 1 - r / (90 * scale));
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;
      ctx.beginPath(); ctx.arc(sx, sy, (2 + Math.sin(seed)) * scale, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? '#ffd700' : i % 3 === 1 ? '#ff8844' : '#ffffff';
      ctx.globalAlpha = alpha * 0.7; ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 원자 이동: 시작(phase1 끝) → 끝(NH₃ 배치)
    const motions = [
      { el: 'N', sx: -94, sy: 0,   ex: -70, ey: 0 },
      { el: 'N', sx: -46, sy: 0,   ex:  70, ey: 0 },
      { el: 'H', sx:  56, sy: -50, ex: -98, ey: -22 },
      { el: 'H', sx:  84, sy: -50, ex: -42, ey: -22 },
      { el: 'H', sx:  80, sy:   5, ex: -70, ey:  32 },
      { el: 'H', sx: 108, sy:   5, ex:  42, ey: -22 },
      { el: 'H', sx:  56, sy:  50, ex:  98, ey: -22 },
      { el: 'H', sx:  84, sy:  50, ex:  70, ey:  32 },
    ];
    motions.forEach(a => {
      const ax = cx + (a.sx + (a.ex - a.sx) * ep) * scale;
      const ay = cy + (a.sy + (a.ey - a.sy) * ep) * scale;
      drawGlossyAtom(ctx, ax, ay, a.el, scale * (0.85 + ep * 0.15));
    });

    // 새 결합선 (진행률에 따라 서서히 표시)
    if (ep > 0.6) {
      const bondAlpha = (ep - 0.6) / 0.4;
      ctx.globalAlpha = bondAlpha * 0.5;
      // NH₃ #1 결합
      const n1 = { x: cx + (-70) * scale, y: cy };
      [{ x: cx + (-98) * scale, y: cy + (-22) * scale },
       { x: cx + (-42) * scale, y: cy + (-22) * scale },
       { x: cx + (-70) * scale, y: cy + 32 * scale }].forEach(h =>
        drawBondStick(ctx, n1.x, n1.y, h.x, h.y, scale, 1));
      // NH₃ #2 결합
      const n2 = { x: cx + 70 * scale, y: cy };
      [{ x: cx + 42 * scale, y: cy + (-22) * scale },
       { x: cx + 98 * scale, y: cy + (-22) * scale },
       { x: cx + 70 * scale, y: cy + 32 * scale }].forEach(h =>
        drawBondStick(ctx, n2.x, n2.y, h.x, h.y, scale, 1));
      ctx.globalAlpha = 1;
    }

    drawLabel(ctx, cx, cy - 120 * scale, '결합 분해 → 새 결합 형성 중', '#ffd700', scale);

  } else {
    /* ── Phase 3: 생성물 ── */
    const p = easeInOut(phase - 2);
    drawNH3Molecule(ctx, cx - 70 * scale, cy, scale, t, p);
    drawNH3Molecule(ctx, cx + 70 * scale, cy, scale, t + 1.5, p);

    ctx.fillStyle = '#aaffaa'; ctx.font = `${12 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('NH₃', cx - 70 * scale, cy + 58 * scale);
    ctx.fillText('NH₃', cx + 70 * scale, cy + 58 * scale);

    if (p > 0.5) {
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + t * 0.5;
        const r = (65 + Math.sin(t * 2 + i) * 10) * scale;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        ctx.beginPath(); ctx.arc(px, py, 2.5 * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,255,150,${(p - 0.5) * 0.5})`;
        ctx.fill();
      }
    }
    drawLabel(ctx, cx, cy - 110 * scale, '2NH₃ 생성 완료!', '#aaffaa', scale);
  }
}

/* ── NH₃ 분자 렌더링 (피라미드형) ── */
function drawNH3Molecule(
  ctx: CanvasRenderingContext2D,
  mx: number, my: number, sc: number, t: number, appear: number
) {
  const bob = Math.sin(t * 1.5) * 3 * sc;
  const ny = my + bob;
  const hs = [
    { x: mx - 28 * sc, y: ny - 22 * sc },
    { x: mx + 28 * sc, y: ny - 22 * sc },
    { x: mx,           y: ny + 32 * sc },
  ];
  ctx.globalAlpha = Math.min(1, appear * 2.5);
  hs.forEach(h => drawBondStick(ctx, mx, ny, h.x, h.y, sc, 1));
  ctx.globalAlpha = 1;
  hs.forEach(h => drawGlossyAtom(ctx, h.x, h.y, 'H', sc));
  drawGlossyAtom(ctx, mx, ny, 'N', sc, appear > 0.7 ? 'rgba(100,255,150,0.15)' : undefined);
  if (appear > 0.5) {
    ctx.beginPath(); ctx.arc(mx, my + bob, 48 * sc, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(100,255,150,${(appear - 0.5) * 0.4})`;
    ctx.lineWidth = 1.5 * sc; ctx.stroke();
  }
}

/* ── 범용 합성 폴백 ── */
function drawGenericSynthesisFallback(
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
    drawLabel(ctx, cx, cy - 120 * scale, '반응물이 서로 접근 중', '#aaddff', scale);
  } else if (phase < 2) {
    const p = phase - 1;
    const glowR = (30 + p * 50) * scale;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, 'rgba(255,220,50,0.8)');
    glow.addColorStop(0.5, 'rgba(255,140,0,0.4)');
    glow.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow; ctx.fill();
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
      ctx.beginPath(); ctx.arc(x, y, (40 + Math.sin(t * 2) * 5) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = color + '44'; ctx.lineWidth = 2 * scale; ctx.stroke();
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
      ctx.font = `bold ${8 * scale}px sans-serif`;
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
    ctx.font = `bold ${11 * scale}px sans-serif`;
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

// ─────────────────────────────────────────────────────────────────────────────
// 고품질 원자 / 결합 렌더링
// ─────────────────────────────────────────────────────────────────────────────
const ATOM_VISUAL: Record<string, { fill: string; hi: string; lo: string; r: number; tc: string }> = {
  N: { fill: '#4466ee', hi: '#7799ff', lo: '#2244aa', r: 22, tc: '#fff' },
  H: { fill: '#dde0f0', hi: '#ffffff', lo: '#8888aa', r: 13, tc: '#444' },
};

function drawGlossyAtom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, el: string, sc: number, glowColor?: string
) {
  const s = ATOM_VISUAL[el] ?? { fill: '#888', hi: '#bbb', lo: '#555', r: 18, tc: '#fff' };
  const r = s.r * sc;

  if (glowColor) {
    const gg = ctx.createRadialGradient(x, y, r, x, y, r * 1.8);
    gg.addColorStop(0, glowColor);
    gg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = gg; ctx.fill();
  }

  // 그림자
  ctx.beginPath(); ctx.arc(x + 2 * sc, y + 3 * sc, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();

  // 본체 그라디언트
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  bg.addColorStop(0, s.hi); bg.addColorStop(0.55, s.fill); bg.addColorStop(1, s.lo);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = s.lo; ctx.lineWidth = 1.2 * sc; ctx.stroke();

  // 광택 하이라이트
  const sg = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, 0, x - r * 0.15, y - r * 0.15, r * 0.55);
  sg.addColorStop(0, 'rgba(255,255,255,0.65)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = sg; ctx.fill();

  // 원소 기호
  ctx.fillStyle = s.tc;
  ctx.font = `bold ${r * 0.85}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(el, x, y + sc * 0.5);
}

function drawBondStick(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  sc: number, order: number
) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.1) return;
  const nx = (-dy / len) * 3.5 * sc;
  const ny = (dx / len) * 3.5 * sc;
  for (let i = 0; i < order; i++) {
    const off = i - (order - 1) / 2;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * off, y1 + ny * off);
    ctx.lineTo(x2 + nx * off, y2 + ny * off);
    ctx.strokeStyle = 'rgba(170,190,220,0.6)';
    ctx.lineWidth = 2.5 * sc; ctx.lineCap = 'round'; ctx.stroke();
  }
}
