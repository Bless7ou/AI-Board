import { useState, useEffect, useRef, useCallback } from 'react';
import MiniCanvas from '../components/MiniCanvas';

interface Props {
  playing: boolean;
  speed: number;
  formula?: string;
}

// ── 공유결합 분자 데이터 ─────────────────────────────────────────────
interface CovalentMol {
  label: string;
  center: { symbol: string; valence: number; color: string; darkColor: string };
  outers: { symbol: string; color: string; darkColor: string }[];
  bondAngle: number;       // 전체 각도 (H₂O=104.5, NH₃=107, CH₄=109.5 등)
  shape: string;           // 분자 모양 이름
  polarity: string;        // 극성/무극성
  lonePairs: number;       // 비공유전자쌍 수
  description: string;
}

const MOLECULES: Record<string, CovalentMol> = {
  'H2O': {
    label: 'H₂O', center: { symbol: 'O', valence: 6, color: '#ff8888', darkColor: '#cc0000' },
    outers: [
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
    ],
    bondAngle: 104.5, shape: '굽은형', polarity: '극성', lonePairs: 2,
    description: '공유결합: 각 원자가 전자쌍을 공유 | 굽은형(104.5°) | 극성 분자',
  },
  'NH3': {
    label: 'NH₃', center: { symbol: 'N', valence: 5, color: '#7090ff', darkColor: '#3050cc' },
    outers: [
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
    ],
    bondAngle: 107, shape: '삼각뿔형', polarity: '극성', lonePairs: 1,
    description: '공유결합: N이 3개 H와 전자쌍 공유 | 삼각뿔형(107°) | 극성 분자',
  },
  'CH4': {
    label: 'CH₄', center: { symbol: 'C', valence: 4, color: '#aaaaaa', darkColor: '#555555' },
    outers: [
      { symbol: 'H', color: '#ffffff', darkColor: '#bbbbbb' },
      { symbol: 'H', color: '#ffffff', darkColor: '#bbbbbb' },
      { symbol: 'H', color: '#ffffff', darkColor: '#bbbbbb' },
      { symbol: 'H', color: '#ffffff', darkColor: '#bbbbbb' },
    ],
    bondAngle: 109.5, shape: '정사면체형', polarity: '무극성', lonePairs: 0,
    description: '공유결합: C가 4개 H와 전자쌍 공유 | 정사면체(109.5°) | 무극성',
  },
  'CO2': {
    label: 'CO₂', center: { symbol: 'C', valence: 4, color: '#aaaaaa', darkColor: '#555555' },
    outers: [
      { symbol: 'O', color: '#ff8888', darkColor: '#cc0000' },
      { symbol: 'O', color: '#ff8888', darkColor: '#cc0000' },
    ],
    bondAngle: 180, shape: '직선형', polarity: '무극성', lonePairs: 0,
    description: '이중결합 2개 | 직선형(180°) | 무극성 분자',
  },
  'HCl': {
    label: 'HCl', center: { symbol: 'Cl', valence: 7, color: '#66ff66', darkColor: '#1a8a1a' },
    outers: [
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
    ],
    bondAngle: 180, shape: '직선형', polarity: '극성', lonePairs: 3,
    description: '공유결합: H-Cl | 직선형 | 극성 분자(전기음성도 차이)',
  },
  'HF': {
    label: 'HF', center: { symbol: 'F', valence: 7, color: '#90e050', darkColor: '#509020' },
    outers: [
      { symbol: 'H', color: '#ffffff', darkColor: '#aaaaaa' },
    ],
    bondAngle: 180, shape: '직선형', polarity: '극성', lonePairs: 3,
    description: '공유결합: H-F | 가장 큰 전기음성도 차이 | 강한 극성',
  },
};

const PRESETS = ['H2O','NH3','CH4','CO2','HCl','HF'];
const FORMULA_ALIASES: Record<string, string> = {
  'H20':'H2O','h2o':'H2O','nh3':'NH3','ch4':'CH4','co2':'CO2','hcl':'HCl','hf':'HF',
  'H2o':'H2O','Co2':'CO2','Nh3':'NH3','Ch4':'CH4','Hcl':'HCl','Hf':'HF',
};

function toSub(f: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return f.replace(/(\d+)/g, (_, n: string) => n.split('').map((c: string) => sub[+c]).join(''));
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CovalentBondSim({ playing, speed, formula }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);

  const [selected, setSelected] = useState(formula ?? 'H2O');
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  const mol = MOLECULES[selected] ?? MOLECULES['H2O'];
  const molRef = useRef(mol);
  useEffect(() => { molRef.current = mol; }, [mol]);

  const handleSelect = useCallback((f: string) => {
    setSelected(f); setShowPicker(false); setInputError(''); tRef.current = 0;
  }, []);

  const handleMiniRecognize = useCallback((text: string) => {
    const clean = text.replace(/\s+/g, '');
    const key = FORMULA_ALIASES[clean] ?? clean;
    if (MOLECULES[key]) { handleSelect(key); }
    else { setInputError(`"${text}"는 지원하지 않는 분자입니다`); }
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
      const phase = t % 2;
      const scale = Math.min(W, H) / 500;
      const cx = W / 2, cy = H / 2 - 10 * scale;
      const m = molRef.current;

      drawBg(ctx, W, H);
      drawTitle(ctx, phase, W, scale, m.label);

      const n = m.outers.length;
      const halfAngle = (m.bondAngle / 2) * (Math.PI / 180);

      if (phase < 1) {
        // ── 접근 + 공유결합 형성 ──
        const p = easeInOut(phase);
        const dist = 140 * scale * (1 - p * 0.55);

        // 외곽 원자 위치 계산
        const outerPositions = getOuterPositions(cx, cy, n, dist, halfAngle);

        drawAtomCircle(ctx, cx, cy, 32 * scale, m.center.color, m.center.darkColor, m.center.symbol);
        outerPositions.forEach((pos, i) => {
          drawAtomCircle(ctx, pos.x, pos.y, 20 * scale, m.outers[i].color, m.outers[i].darkColor, m.outers[i].symbol);
          if (p > 0.4) drawSharedElectrons(ctx, cx, cy, pos.x, pos.y, scale, p, t, i);
        });

        drawLabel(ctx, cx, cy - 140 * scale, '원자 접근 → 전자쌍 공유 형성 중', '#aaddff', scale);
      } else {
        // ── 완성 구조 ──
        const bondLen = 75 * scale;
        const outerPositions = getOuterPositions(cx, cy - 20 * scale, n, bondLen, halfAngle);

        // 결합선
        outerPositions.forEach(pos => {
          ctx.beginPath(); ctx.moveTo(cx, cy - 20 * scale); ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = 'rgba(150,200,255,0.8)'; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round'; ctx.stroke();
        });

        drawAtomCircle(ctx, cx, cy - 20 * scale, 32 * scale, m.center.color, m.center.darkColor, m.center.symbol);
        outerPositions.forEach((pos, i) => {
          drawAtomCircle(ctx, pos.x, pos.y, 20 * scale, m.outers[i].color, m.outers[i].darkColor, m.outers[i].symbol);
        });

        // 비공유전자쌍
        if (m.lonePairs > 0) drawLonePairs(ctx, cx, cy - 20 * scale, scale, t, m.lonePairs, n, halfAngle);

        // 극성 표시
        if (m.polarity === '극성') {
          ctx.fillStyle = '#ff6666'; ctx.font = `${13 * scale}px sans-serif`;
          ctx.textAlign = 'center'; ctx.fillText('δ−', cx, cy - 70 * scale);
        }

        // 각도 표시 (2개 이상 외곽 원자)
        if (n >= 2) {
          drawAngleArc(ctx, cx, cy - 20 * scale, outerPositions[0], outerPositions[n - 1], scale, m.bondAngle);
        }

        drawLabel(ctx, cx, cy - 140 * scale, `${m.label}: ${m.shape} (${m.bondAngle}°)`, '#aaffaa', scale);
        drawLabel(ctx, cx, cy - 115 * scale, `${m.polarity} 공유결합 | 비공유전자쌍 ${m.lonePairs}쌍`, '#88ff88', scale);
      }

      drawLegend(ctx, W, H, scale, m.description);
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
          {toSub(selected)} ▾
        </button>

        {showPicker && (
          <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
            <MiniCanvas
              onRecognize={handleMiniRecognize}
              onClose={() => { setShowPicker(false); setInputError(''); }}
              placeholder="분자식을 쓰세요 (예: NH3)"
              width={230} height={90}
            />
            {inputError && (
              <div style={{ fontSize: 10, color: '#ff7766', textAlign: 'center', padding: '4px 0' }}>{inputError}</div>
            )}
            <div style={{
              marginTop: 6, padding: '6px 10px',
              background: 'rgba(8,14,30,0.95)', border: '1px solid rgba(60,120,240,0.25)',
              borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 4, width: 250,
            }}>
              <div style={{ fontSize: 9, color: '#445566', width: '100%', marginBottom: 2 }}>또는 선택:</div>
              {PRESETS.map(f => (
                <button key={f} onClick={() => handleSelect(f)}
                  style={{
                    background: selected === f ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                    border: `1px solid ${selected === f ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                    borderRadius: 7, padding: '4px 8px',
                    color: selected === f ? '#aaccff' : '#5577aa',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Courier New, monospace',
                  }}>
                  {toSub(f)}
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

function getOuterPositions(cx: number, cy: number, n: number, dist: number, halfAngle: number) {
  if (n === 1) return [{ x: cx + dist, y: cy }];
  if (n === 2) return [
    { x: cx - Math.sin(halfAngle) * dist, y: cy + Math.cos(halfAngle) * dist },
    { x: cx + Math.sin(halfAngle) * dist, y: cy + Math.cos(halfAngle) * dist },
  ];
  if (n === 3) return [
    { x: cx - Math.sin(halfAngle) * dist, y: cy + Math.cos(halfAngle) * dist * 0.8 },
    { x: cx, y: cy + dist * 0.9 },
    { x: cx + Math.sin(halfAngle) * dist, y: cy + Math.cos(halfAngle) * dist * 0.8 },
  ];
  // 4개 (정사면체 2D 투영)
  return [
    { x: cx - dist * 0.7, y: cy - dist * 0.4 },
    { x: cx + dist * 0.7, y: cy - dist * 0.4 },
    { x: cx - dist * 0.45, y: cy + dist * 0.7 },
    { x: cx + dist * 0.45, y: cy + dist * 0.7 },
  ];
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a1a'); g.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawAtomCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, light: string, dark: string, label: string) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, light); g.addColorStop(1, dark);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.shadowColor = light; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
  const textColor = isLightColor(light) ? '#222' : '#fff';
  ctx.fillStyle = textColor; ctx.font = `bold ${r * 0.75}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
}

function drawSharedElectrons(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, scale: number, progress: number, t: number, idx: number) {
  const midX = x1 + (x2 - x1) * 0.5, midY = y1 + (y2 - y1) * 0.5;
  const wobble = Math.sin(t * 5 + idx) * 5 * scale;
  const opacity = Math.min(1, progress * 2);
  [-1, 1].forEach(s => {
    ctx.beginPath(); ctx.arc(midX + s * 8 * scale * progress, midY + wobble, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,80,${opacity})`; ctx.shadowColor = '#ffdd55'; ctx.shadowBlur = 8 * scale;
    ctx.fill(); ctx.shadowBlur = 0;
  });
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(150,200,255,${opacity * 0.7})`; ctx.lineWidth = 3 * scale; ctx.stroke();
}

function drawLonePairs(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number, pairs: number, _outerCount: number, _halfAngle: number) {
  const startAngle = -Math.PI * 0.5;
  const spread = Math.PI * 0.4;
  for (let i = 0; i < pairs; i++) {
    const angle = startAngle + (i - (pairs - 1) / 2) * spread / Math.max(1, pairs - 1);
    const r = 42 * scale;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    const wobble = Math.sin(t * 3 + i) * 2 * scale;
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.arc(px + s * 6 * scale, py + wobble, 4 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9966'; ctx.shadowColor = '#ff9966'; ctx.shadowBlur = 6 * scale; ctx.fill(); ctx.shadowBlur = 0;
    });
  }
  ctx.fillStyle = '#ff9966'; ctx.font = `${10 * scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`비공유 전자쌍 ${pairs}쌍`, x, y - 45 * scale);
}

function drawAngleArc(ctx: CanvasRenderingContext2D, ox: number, oy: number, p1: { x: number; y: number }, p2: { x: number; y: number }, scale: number, angle: number) {
  const a1 = Math.atan2(p1.y - oy, p1.x - ox), a2 = Math.atan2(p2.y - oy, p2.x - ox);
  ctx.beginPath(); ctx.arc(ox, oy, 30 * scale, a1, a2);
  ctx.strokeStyle = 'rgba(255,255,100,0.6)'; ctx.lineWidth = 1.5 * scale; ctx.stroke();
  const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
  ctx.fillStyle = '#ffff88'; ctx.font = `${12 * scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${angle}°`, midX, midY + 5 * scale);
}

function drawTitle(ctx: CanvasRenderingContext2D, phase: number, W: number, scale: number, label: string) {
  const text = phase < 1 ? `① ${label} 공유결합 형성` : `② ${label} 분자 완성`;
  ctx.fillStyle = '#1a2a4a'; ctx.beginPath();
  ctx.roundRect(W / 2 - 90 * scale, 12 * scale, 180 * scale, 28 * scale, 6 * scale); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#88ccff'; ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText(text, W / 2, 26 * scale);
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, scale: number) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = color;
  ctx.font = `${13 * scale}px sans-serif`; ctx.fillText(text, x, y);
}

function drawLegend(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number, desc: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath();
  ctx.roundRect(10 * scale, H - 60 * scale, W - 20 * scale, 50 * scale, 8 * scale); ctx.fill();
  ctx.fillStyle = '#cce0ff'; ctx.font = `${11 * scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(desc, W / 2, H - 35 * scale);
}

function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
