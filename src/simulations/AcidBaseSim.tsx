import { useState, useEffect, useRef, useCallback } from 'react';
import MiniCanvas from '../components/MiniCanvas';

interface Props {
  playing: boolean;
  speed: number;
  reaction?: string;
}

// ── 산염기 반응 데이터 ─────────────────────────────────────────────
interface AcidBaseReaction {
  label: string;
  equation: string;
  acid: { formula: string; cation: string; anion: string; color: string };
  base: { formula: string; cation: string; anion: string; color: string };
  salt: string;
  description: string;
}

const REACTIONS: Record<string, AcidBaseReaction> = {
  'HCl+NaOH': {
    label: 'HCl + NaOH',
    equation: 'HCl + NaOH → NaCl + H₂O',
    acid: { formula: 'HCl', cation: 'H⁺', anion: 'Cl⁻', color: '#ff8888' },
    base: { formula: 'NaOH', cation: 'Na⁺', anion: 'OH⁻', color: '#cc88ff' },
    salt: 'NaCl',
    description: 'HCl(강산) + NaOH(강염기) → NaCl(염) + H₂O | 완전 중화',
  },
  'HCl+KOH': {
    label: 'HCl + KOH',
    equation: 'HCl + KOH → KCl + H₂O',
    acid: { formula: 'HCl', cation: 'H⁺', anion: 'Cl⁻', color: '#ff8888' },
    base: { formula: 'KOH', cation: 'K⁺', anion: 'OH⁻', color: '#bb77ee' },
    salt: 'KCl',
    description: 'HCl(강산) + KOH(강염기) → KCl(염) + H₂O | 완전 중화',
  },
  'HNO3+NaOH': {
    label: 'HNO₃ + NaOH',
    equation: 'HNO₃ + NaOH → NaNO₃ + H₂O',
    acid: { formula: 'HNO₃', cation: 'H⁺', anion: 'NO₃⁻', color: '#ff6666' },
    base: { formula: 'NaOH', cation: 'Na⁺', anion: 'OH⁻', color: '#cc88ff' },
    salt: 'NaNO₃',
    description: 'HNO₃(강산) + NaOH(강염기) → NaNO₃(염) + H₂O | 완전 중화',
  },
  'H2SO4+NaOH': {
    label: 'H₂SO₄ + 2NaOH',
    equation: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
    acid: { formula: 'H₂SO₄', cation: 'H⁺', anion: 'SO₄²⁻', color: '#ff5555' },
    base: { formula: 'NaOH', cation: 'Na⁺', anion: 'OH⁻', color: '#cc88ff' },
    salt: 'Na₂SO₄',
    description: 'H₂SO₄(강산) + 2NaOH(강염기) → Na₂SO₄ + 2H₂O | 2가산 중화',
  },
  'H2SO4+KOH': {
    label: 'H₂SO₄ + 2KOH',
    equation: 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O',
    acid: { formula: 'H₂SO₄', cation: 'H⁺', anion: 'SO₄²⁻', color: '#ff5555' },
    base: { formula: 'KOH', cation: 'K⁺', anion: 'OH⁻', color: '#bb77ee' },
    salt: 'K₂SO₄',
    description: 'H₂SO₄(강산) + 2KOH(강염기) → K₂SO₄ + 2H₂O | 2가산 중화',
  },
  'CH3COOH+NaOH': {
    label: 'CH₃COOH + NaOH',
    equation: 'CH₃COOH + NaOH → CH₃COONa + H₂O',
    acid: { formula: 'CH₃COOH', cation: 'H⁺', anion: 'CH₃COO⁻', color: '#ffaa66' },
    base: { formula: 'NaOH', cation: 'Na⁺', anion: 'OH⁻', color: '#cc88ff' },
    salt: 'CH₃COONa',
    description: 'CH₃COOH(약산) + NaOH(강염기) → CH₃COONa + H₂O | 약산 중화',
  },
};

const PRESETS = ['HCl+NaOH', 'HCl+KOH', 'HNO3+NaOH', 'H2SO4+NaOH', 'H2SO4+KOH', 'CH3COOH+NaOH'];
const PRESET_LABELS: Record<string, string> = {
  'HCl+NaOH': 'HCl+NaOH',
  'HCl+KOH': 'HCl+KOH',
  'HNO3+NaOH': 'HNO₃+NaOH',
  'H2SO4+NaOH': 'H₂SO₄+NaOH',
  'H2SO4+KOH': 'H₂SO₄+KOH',
  'CH3COOH+NaOH': 'CH₃COOH+NaOH',
};

// OCR 보정용 별칭
const REACTION_ALIASES: Record<string, string> = {
  'hcl+naoh': 'HCl+NaOH', 'HCI+NaOH': 'HCl+NaOH', 'Hcl+NaOH': 'HCl+NaOH',
  'hcl+koh': 'HCl+KOH', 'HCI+KOH': 'HCl+KOH',
  'hno3+naoh': 'HNO3+NaOH', 'HN03+NaOH': 'HNO3+NaOH',
  'h2so4+naoh': 'H2SO4+NaOH', 'H2S04+NaOH': 'H2SO4+NaOH',
  'h2so4+koh': 'H2SO4+KOH', 'H2S04+KOH': 'H2SO4+KOH',
  'ch3cooh+naoh': 'CH3COOH+NaOH',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function AcidBaseSim({ playing, speed, reaction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);

  const [selected, setSelected] = useState(reaction ?? 'HCl+NaOH');
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  const rxn = REACTIONS[selected] ?? REACTIONS['HCl+NaOH'];
  const rxnRef = useRef(rxn);
  useEffect(() => { rxnRef.current = rxn; }, [rxn]);

  const handleSelect = useCallback((key: string) => {
    setSelected(key); setShowPicker(false); setInputError(''); tRef.current = 0;
  }, []);

  const handleMiniRecognize = useCallback((text: string) => {
    // 입력에서 + 를 기준으로 산+염기 조합 추출
    const clean = text.replace(/\s+/g, '').replace(/→.*/, '');
    const key = REACTION_ALIASES[clean] ?? clean;
    if (REACTIONS[key]) { handleSelect(key); return; }
    // + 포함된 입력 파싱 시도
    const parts = clean.split('+');
    if (parts.length === 2) {
      const tryKey = parts.join('+');
      const alias = REACTION_ALIASES[tryKey.toLowerCase()] ?? tryKey;
      if (REACTIONS[alias]) { handleSelect(alias); return; }
    }
    setInputError(`"${text}" — 지원하지 않는 반응입니다`);
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
      if (playing) tRef.current += 0.01 * speed;
      const t = tRef.current;
      const phase = t % 3;
      const scale = Math.min(W, H) / 500;
      const cx = W / 2, cy = H / 2;
      const r = rxnRef.current;

      drawBg(ctx, W, H);
      drawPhaseLabel(ctx, phase, W, scale);

      if (phase < 1) {
        const p = easeInOut(phase);
        drawDissociation(ctx, cx, cy, scale, p, t, r);
        drawLabel(ctx, cx, 55 * scale, `${r.acid.formula}과 ${r.base.formula}가 이온으로 해리`, '#aaddff', scale);
      } else if (phase < 2) {
        const p = easeInOut(phase - 1);
        drawNeutralization(ctx, cx, cy, scale, p, t, r);
        drawLabel(ctx, cx, 55 * scale, `H⁺ + OH⁻ → H₂O (중화)`, '#ffd700', scale);
      } else {
        drawProducts(ctx, cx, cy, scale, t, r);
        drawLabel(ctx, cx, 55 * scale, `${r.salt} + H₂O 생성`, '#aaffaa', scale);
      }

      drawEquation(ctx, W, H, scale, r);
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [playing, speed]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* 선택 UI */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 5 }}>
        <button onClick={() => { setShowPicker(v => !v); setInputError(''); }}
          style={{
            background: showPicker ? 'rgba(60,120,255,0.4)' : 'rgba(10,20,50,0.7)',
            border: '1px solid rgba(80,150,255,0.4)', borderRadius: 8, padding: '4px 12px',
            color: '#aaccff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
          {rxn.label} ▾
        </button>

        {showPicker && (
          <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
            <MiniCanvas
              onRecognize={handleMiniRecognize}
              onClose={() => { setShowPicker(false); setInputError(''); }}
              placeholder="반응식을 쓰세요 (예: HCl+NaOH)"
              width={260} height={90}
            />
            {inputError && (
              <div style={{ fontSize: 10, color: '#ff7766', textAlign: 'center', padding: '4px 0' }}>{inputError}</div>
            )}
            <div style={{
              marginTop: 6, padding: '6px 10px',
              background: 'rgba(8,14,30,0.95)', border: '1px solid rgba(60,120,240,0.25)',
              borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 4, width: 280,
            }}>
              <div style={{ fontSize: 9, color: '#445566', width: '100%', marginBottom: 2 }}>또는 선택:</div>
              {PRESETS.map(key => (
                <button key={key} onClick={() => handleSelect(key)}
                  style={{
                    background: selected === key ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                    border: `1px solid ${selected === key ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                    borderRadius: 7, padding: '3px 7px',
                    color: selected === key ? '#aaccff' : '#5577aa',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Drawing helpers
// ═════════════════════════════════════════════════════════════════════════════

function drawDissociation(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, p: number, _t: number,
  r: AcidBaseReaction
) {
  const leftX = cx - 130 * scale;
  const hX = leftX - p * 35 * scale;
  const anionX = leftX + p * 35 * scale;

  drawIon(ctx, hX, cy - 30 * scale, r.acid.cation, r.acid.color, 22, scale);
  drawIon(ctx, anionX, cy + 30 * scale, r.acid.anion, '#66ff66', 26, scale);

  const rightX = cx + 130 * scale;
  const catX = rightX + p * 35 * scale;
  const ohX = rightX - p * 35 * scale;

  drawIon(ctx, catX, cy - 30 * scale, r.base.cation, r.base.color, 24, scale);
  drawIon(ctx, ohX, cy + 30 * scale, r.base.anion, '#ff8844', 26, scale);

  ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${r.acid.formula} 해리`, leftX, cy - 80 * scale);
  ctx.fillText(`${r.base.formula} 해리`, rightX, cy - 80 * scale);
}

function drawNeutralization(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, p: number, t: number,
  r: AcidBaseReaction
) {
  const hX = cx - 100 * scale * (1 - p) - 30 * scale;
  const ohX = cx + 100 * scale * (1 - p) + 30 * scale;

  if (p < 0.8) {
    drawIon(ctx, hX, cy, r.acid.cation, r.acid.color, 22, scale);
    drawIon(ctx, ohX, cy, r.base.anion, '#ff8844', 26, scale);
    drawArrow(ctx, hX + 25 * scale, cy, ohX - 30 * scale, cy, '#ffff88', scale);
  } else {
    const flash = Math.max(0, (p - 0.8) * 5);
    ctx.globalAlpha = flash;
    drawWaterMolecule(ctx, cx, cy, scale, t);
    ctx.globalAlpha = 1;
  }

  // 나머지 이온 (옆에 남아있음)
  drawIon(ctx, cx - 100 * scale, cy - 70 * scale, r.base.cation, r.base.color, 24, scale);
  drawIon(ctx, cx + 100 * scale, cy - 70 * scale, r.acid.anion, '#66ff66', 26, scale);
}

function drawProducts(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, t: number,
  r: AcidBaseReaction
) {
  // H₂O
  drawWaterMolecule(ctx, cx - 60 * scale, cy + 20 * scale, scale, t);

  // 염 이온쌍
  drawIon(ctx, cx + 80 * scale, cy - 20 * scale, r.base.cation, r.base.color, 26, scale);
  drawIon(ctx, cx + 80 * scale, cy + 40 * scale, r.acid.anion, '#66ff66', 26, scale);

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
  ctx.fillText(r.salt, cx + 80 * scale, cy + 75 * scale);
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
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(h2x, h2y); ctx.stroke();

  // O
  const og = ctx.createRadialGradient(x - oR * 0.3, y - oR * 0.3, oR * 0.1, x, y, oR);
  og.addColorStop(0, '#ff8888'); og.addColorStop(1, '#cc0000');
  ctx.beginPath(); ctx.arc(x, y, oR, 0, Math.PI * 2);
  ctx.fillStyle = og; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * scale}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('O', x, y);

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
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = 2 * scale; ctx.stroke();
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const hl = 10 * scale;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * hl + uy * hl * 0.5, y2 - uy * hl - ux * hl * 0.5);
  ctx.lineTo(x2 - ux * hl - uy * hl * 0.5, y2 - uy * hl + ux * hl * 0.5);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = color; ctx.font = `${13 * scale}px sans-serif`;
  ctx.fillText(text, x, y);
}

function drawPhaseLabel(ctx: CanvasRenderingContext2D, phase: number, W: number, scale: number) {
  const labels = ['① 이온 해리', '② 중화 반응', '③ 생성물'];
  const idx = Math.min(2, Math.floor(phase));
  ctx.fillStyle = '#1a2a4a';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 65 * scale, 12 * scale, 130 * scale, 28 * scale, 6 * scale);
  ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff'; ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(labels[idx], W / 2, 26 * scale);
}

function drawEquation(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number, r: AcidBaseReaction) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale);
  ctx.fill();
  ctx.fillStyle = '#cce0ff'; ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${r.equation}  |  산 + 염기 → 염 + 물`, W / 2, H - 35 * scale);
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}

function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
}
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  if (c.length === 3) return [parseInt(c[0] + c[0], 16), parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16)];
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
