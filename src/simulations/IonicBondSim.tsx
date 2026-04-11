import { useState, useEffect, useRef, useCallback } from 'react';
import { ATOMS, ELECTRON_CONFIG } from '../chemistry/atomData';
import { IONIC_DB, resolveIonicPair } from '../chemistry/ionicData';
import type { IonicPair } from '../chemistry/types';
import MiniCanvas from '../components/MiniCanvas';

interface Props {
  playing: boolean;
  speed: number;
  /** 외부에서 지정한 이온쌍 (없으면 기본 NaCl) */
  ionicPair?: IonicPair;
}

// ── 선택 가능한 이온쌍 프리셋 ──────────────────────────────────────────────
const PRESETS: { label: string; formula: string }[] = [
  { label: 'NaCl',   formula: 'NaCl' },
  { label: 'KCl',    formula: 'KCl' },
  { label: 'LiF',    formula: 'LiF' },
  { label: 'MgO',    formula: 'MgO' },
  { label: 'CaO',    formula: 'CaO' },
  { label: 'NaF',    formula: 'NaF' },
  { label: 'MgCl₂',  formula: 'MgCl2' },
  { label: 'CaCl₂',  formula: 'CaCl2' },
  { label: 'Al₂O₃',  formula: 'Al2O3' },
  { label: 'Fe₂O₃',  formula: 'Fe2O3' },
];

// ── 원소별 색상 (그라디언트용) ──
function atomColors(symbol: string): { light: string; dark: string } {
  const base = ATOMS[symbol]?.color ?? '#888888';
  return { light: lighten(base, 0.35), dark: darken(base, 0.25) };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function IonicBondSim({ playing, speed, ionicPair }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef(0);
  const tRef      = useRef(0);

  const [selectedFormula, setSelectedFormula] = useState('NaCl');
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  // 현재 활성 이온쌍 결정: 외부 prop > 사용자 선택 > 기본값
  const pair: IonicPair = ionicPair ?? IONIC_DB[selectedFormula] ?? IONIC_DB['NaCl'];
  const pairRef = useRef(pair);
  useEffect(() => { pairRef.current = pair; }, [pair]);

  const handleSelect = useCallback((formula: string) => {
    setSelectedFormula(formula);
    setShowPicker(false);
    setInputError('');
    tRef.current = 0;
  }, []);

  /** 미니 판서 인식 결과 처리 */
  const handleMiniRecognize = useCallback((text: string) => {
    // 공백·유니코드 숫자 정리
    const clean = text.replace(/\s+/g, '').replace(/[₀-₉]/g, c => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)));
    const resolved = resolveIonicPair(clean);
    if (resolved) {
      // DB에 있으면 그 formula 키 사용, 없으면 임시 등록
      if (IONIC_DB[clean]) {
        handleSelect(clean);
      } else {
        // 자동 파싱으로 찾은 경우 — DB에 동적 추가
        IONIC_DB[clean] = resolved;
        handleSelect(clean);
      }
      setInputError('');
    } else {
      setInputError(`"${text}"는 이온결합 화합물이 아닙니다`);
    }
  }, [handleSelect]);

  // ── 캔버스 애니메이션 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (playing) tRef.current += 0.012 * speed;

      const p = pairRef.current;
      const phase = tRef.current % 3;
      const scale = Math.min(W, H) / 500;
      const cx = W / 2;
      const cy = H / 2 - 10 * scale;

      const catAtom = ATOMS[p.cation];
      const anAtom  = ATOMS[p.anion];
      const catName = catAtom?.name ?? p.cation;
      const anName  = anAtom?.name ?? p.anion;
      const catShells = ELECTRON_CONFIG[p.cation] ?? [2, 8, p.cationCharge];
      const anShells  = ELECTRON_CONFIG[p.anion]  ?? [2, 8, 8 - Math.abs(p.anionCharge)];
      const catCol = atomColors(p.cation);
      const anCol  = atomColors(p.anion);

      // 배경
      drawBg(ctx, W, H);
      drawStageLabel(ctx, phase, W, scale);

      if (phase < 1) {
        // ── 1단계: 접근 ──
        const prog = easeInOut(phase);
        const dist = 180 * scale * (1 - prog * 0.5);
        drawAtom(ctx, cx - dist, cy, scale, catCol, p.cation, false);
        drawAtom(ctx, cx + dist, cy, scale, anCol, p.anion, false);
        drawShells(ctx, cx - dist, cy, scale, catShells, -1, 0, catCol.dark);
        drawShells(ctx, cx + dist, cy, scale, anShells, -1, 0, anCol.dark);
        drawArrowLine(ctx, cx - dist + 42 * scale, cy, cx + dist - 42 * scale, cy, '#ffff88', scale);
        drawLabel(ctx, cx, cy - 130 * scale, `서로 접근하는 ${catName}와(과) ${anName}`, '#cce0ff', scale);

      } else if (phase < 2) {
        // ── 2단계: 전자 이동 ──
        const prog = easeInOut(phase - 1);
        const dist = 100 * scale;
        const lastShellIdx = catShells.length - 1;

        drawAtom(ctx, cx - dist, cy, scale, catCol, prog > 0.7 ? `${p.cation}${chargeStr(p.cationCharge)}` : p.cation, prog > 0.7);
        drawAtom(ctx, cx + dist, cy, scale, anCol, prog > 0.7 ? `${p.anion}${chargeStr(p.anionCharge)}` : p.anion, prog > 0.7);
        drawShells(ctx, cx - dist, cy, scale, catShells, lastShellIdx, prog, catCol.dark);
        drawShells(ctx, cx + dist, cy, scale, anShells, -1, 0, anCol.dark);

        // 이동하는 전자들
        for (let i = 0; i < p.transfer; i++) {
          const offset = (i - (p.transfer - 1) / 2) * 18 * scale;
          const ex = cx - dist + (2 * dist) * prog;
          const ey = cy - 30 * scale - Math.sin(Math.PI * prog) * 40 * scale + offset;
          drawElectron(ctx, ex, ey, scale);
        }

        drawLabel(ctx, cx, cy - 130 * scale, `${catName}의 전자 ${p.transfer}개가 ${anName}(으)로 이동`, '#ffd700', scale);
        drawLabel(ctx, cx, cy - 105 * scale,
          `${p.cation} → ${p.cation}${chargeStr(p.cationCharge)}  /  ${p.anion} + ${p.transfer}e⁻ → ${p.anion}${chargeStr(p.anionCharge)}`,
          '#ffb347', scale);

      } else {
        // ── 3단계: 이온결합 형성 ──
        const dist = 85 * scale;
        const wobble = Math.sin(tRef.current * 4) * 3 * scale;
        drawAtomIon(ctx, cx - dist, cy, scale, catCol, `${p.cation}${chargeStr(p.cationCharge)}`, 0.85);
        drawAtomIon(ctx, cx + dist, cy, scale, anCol, `${p.anion}${chargeStr(p.anionCharge)}`, 1.15);
        drawIonicBond(ctx, cx - dist, cy, cx + dist, cy, scale, wobble);
        drawLabel(ctx, cx, cy - 130 * scale,
          `${p.cation}${chargeStr(p.cationCharge)}와(과) ${p.anion}${chargeStr(p.anionCharge)}의 이온결합 형성`, '#aaffaa', scale);
        drawLabel(ctx, cx, cy - 105 * scale, '정전기적 인력으로 결합 유지', '#88ff88', scale);
      }

      // 하단 설명
      drawLegend(ctx, W, H, scale, p, catName, anName);
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [playing, speed]);

  // ── 렌더 ──
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* 선택 버튼 (좌상단) */}
      {!ionicPair && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 5 }}>
          <button
            onClick={() => { setShowPicker(v => !v); setInputError(''); }}
            style={{
              background: showPicker ? 'rgba(60,120,255,0.4)' : 'rgba(10,20,50,0.7)',
              border: '1px solid rgba(80,150,255,0.4)',
              borderRadius: 8, padding: '4px 12px',
              color: '#aaccff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            {toSubFormula(selectedFormula)} ▾
          </button>

          {showPicker && (
            <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
              <MiniCanvas
                onRecognize={handleMiniRecognize}
                onClose={() => { setShowPicker(false); setInputError(''); }}
                placeholder="화학식을 쓰세요 (예: MgO)"
                width={230}
                height={90}
              />

              {/* 에러 메시지 */}
              {inputError && (
                <div style={{
                  fontSize: 10, color: '#ff7766', textAlign: 'center',
                  padding: '4px 0', marginTop: -4,
                }}>
                  {inputError}
                </div>
              )}

              {/* 프리셋 바로가기 */}
              <div style={{
                marginTop: 6, padding: '6px 10px',
                background: 'rgba(8,14,30,0.95)',
                border: '1px solid rgba(60,120,240,0.25)',
                borderRadius: 10,
                display: 'flex', flexWrap: 'wrap', gap: 4,
                width: 250,
              }}>
                <div style={{ fontSize: 9, color: '#445566', width: '100%', marginBottom: 2 }}>
                  또는 선택:
                </div>
                {PRESETS.map(p => (
                  <button
                    key={p.formula}
                    onClick={() => handleSelect(p.formula)}
                    style={{
                      background: selectedFormula === p.formula ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                      border: `1px solid ${selectedFormula === p.formula ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                      borderRadius: 7, padding: '4px 8px',
                      color: selectedFormula === p.formula ? '#aaccff' : '#5577aa',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'Courier New, monospace',
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
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Drawing helpers
// ═════════════════════════════════════════════════════════════════════════════

function toSubFormula(formula: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return formula.replace(/(\d+)/g, (_, n: string) => n.split('').map((c: string) => sub[+c]).join(''));
}

function chargeStr(charge: number): string {
  if (charge === 0) return '';
  const abs = Math.abs(charge);
  const sign = charge > 0 ? '⁺' : '⁻';
  return abs === 1 ? sign : `${toSup(abs)}${sign}`;
}
function toSup(n: number): string {
  const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n).split('').map(c => sups[+c]).join('');
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a1a'); g.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawAtom(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  col: { light: string; dark: string }, label: string, _isIon: boolean,
) {
  const r = 32 * scale;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, col.light); g.addColorStop(1, col.dark);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${14 * scale}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function drawAtomIon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  col: { light: string; dark: string }, label: string, rFactor: number,
) {
  const r = 32 * scale * rFactor;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, col.light); g.addColorStop(1, col.dark);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.shadowColor = col.light; ctx.shadowBlur = 15 * scale;
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${15 * scale}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function drawShells(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  shells: number[], removingIdx: number, progress: number, dotColor: string,
) {
  const radii = [50, 75, 100].map(r => r * scale);
  shells.forEach((count, i) => {
    if (i >= radii.length) return;
    let adj = count;
    if (i === removingIdx) adj = Math.max(0, count - Math.round(progress * count));
    // 궤도 원
    ctx.beginPath(); ctx.arc(x, y, radii[i], 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(120,160,255,0.2)'; ctx.lineWidth = scale; ctx.stroke();
    // 전자
    for (let j = 0; j < adj; j++) {
      const angle = (j / Math.max(adj, 1)) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * radii[i], y + Math.sin(angle) * radii[i], 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = i === removingIdx && removingIdx >= 0 ? '#ff8888' : dotColor;
      ctx.fill();
    }
  });
}

function drawElectron(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.beginPath(); ctx.arc(x, y, 7 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b'; ctx.shadowBlur = 10 * scale;
  ctx.fill(); ctx.shadowBlur = 0;
}

function drawIonicBond(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  scale: number, wobble: number,
) {
  ctx.setLineDash([8 * scale, 5 * scale]);
  ctx.strokeStyle = 'rgba(255,215,0,0.7)'; ctx.lineWidth = 2.5 * scale;
  ctx.beginPath(); ctx.moveTo(x1, y1 + wobble); ctx.lineTo(x2, y2 + wobble); ctx.stroke();
  ctx.setLineDash([]);
  drawArrowLine(ctx, x1 + 40 * scale, y1 + wobble, x2 - 40 * scale, y2 + wobble, '#ffd700', scale);
}

function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, scale: number,
) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len, h = 12 * scale;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = 2 * scale; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * h + uy * h * 0.5, y2 - uy * h - ux * h * 0.5);
  ctx.lineTo(x2 - ux * h - uy * h * 0.5, y2 - uy * h + ux * h * 0.5);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = color; ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawStageLabel(ctx: CanvasRenderingContext2D, phase: number, W: number, scale: number) {
  const stages = ['① 접근', '② 전자 이동', '③ 이온결합'];
  const idx = Math.min(2, Math.floor(phase));
  ctx.fillStyle = '#1a2a4a';
  ctx.beginPath(); ctx.roundRect(W / 2 - 60 * scale, 12 * scale, 120 * scale, 28 * scale, 6 * scale); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff'; ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(stages[idx], W / 2, 26 * scale);
}

function drawLegend(
  ctx: CanvasRenderingContext2D, W: number, H: number, scale: number,
  p: IonicPair, catName: string, anName: string,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale); ctx.fill();
  ctx.fillStyle = '#cce0ff'; ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(
    `${catName}(${p.cation})의 전자 ${p.transfer}개가 ${anName}(${p.anion})(으)로 이동 → ` +
    `${p.cation}${chargeStr(p.cationCharge)}, ${p.anion}${chargeStr(p.anionCharge)} 생성 → 정전기적 인력으로 결합`,
    W / 2, H - 35 * scale,
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
