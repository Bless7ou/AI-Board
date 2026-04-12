import { useEffect, useRef, useState, useCallback } from 'react';
import { ATOMS, ELECTRON_CONFIG } from '../chemistry/atomData';
import MiniCanvas from '../components/MiniCanvas';

interface Props {
  element: string;
  playing: boolean;
  speed: number;
}

const ELEMENT_PRESETS: { label: string; symbol: string }[] = [
  { label: 'H  수소',  symbol: 'H' },
  { label: 'C  탄소',  symbol: 'C' },
  { label: 'N  질소',  symbol: 'N' },
  { label: 'O  산소',  symbol: 'O' },
  { label: 'Na 나트륨', symbol: 'Na' },
  { label: 'Mg 마그네슘', symbol: 'Mg' },
  { label: 'Al 알루미늄', symbol: 'Al' },
  { label: 'Cl 염소',  symbol: 'Cl' },
  { label: 'K  칼륨',  symbol: 'K' },
  { label: 'Ca 칼슘',  symbol: 'Ca' },
  { label: 'Fe 철',    symbol: 'Fe' },
  { label: 'Cu 구리',  symbol: 'Cu' },
];

export default function ElectronConfigSim({ element: initialElement, playing, speed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  const [element, setElement] = useState(initialElement);
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => { setElement(initialElement); }, [initialElement]);

  useEffect(() => {
    tRef.current = 0;
  }, [element]);

  const handleSelect = useCallback((sym: string) => {
    setElement(sym);
    setShowPicker(false);
    setInputError('');
    tRef.current = 0;
  }, []);

  const handleMiniRecognize = useCallback((text: string) => {
    const clean = text.trim().replace(/\s+/g, '');
    // 첫 글자 대문자 + 나머지 소문자로 정규화
    const normalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    if (ATOMS[normalized] && ELECTRON_CONFIG[normalized]) {
      handleSelect(normalized);
    } else if (ATOMS[clean] && ELECTRON_CONFIG[clean]) {
      handleSelect(clean);
    } else {
      setInputError(`"${text}" — 등록된 원소가 아닙니다`);
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

    const atom = ATOMS[element];
    const shells = ELECTRON_CONFIG[element];

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (playing) tRef.current += 0.015 * speed;
      const t = tRef.current;

      const scale = Math.min(W, H) / 500;
      const cx = W / 2;
      const cy = H / 2;

      drawBg(ctx, W, H);

      if (!atom || !shells) {
        ctx.fillStyle = '#ff8888';
        ctx.font = `${16 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`'${element}' 원소 데이터 없음`, cx, cy);
        return;
      }

      const shellRadii = shells.map((_, i) => (45 + i * 45) * scale);

      // 궤도 원
      shellRadii.forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80, 120, 200, ${0.2 + i * 0.05})`;
        ctx.lineWidth = 1 * scale;
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 전자껍질 번호
        ctx.fillStyle = 'rgba(100, 140, 220, 0.5)';
        ctx.font = `${10 * scale}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}번 껍질 (${shells[i]}e⁻)`, cx + r + 6 * scale, cy);
      });

      // 전자 그리기
      shells.forEach((count, shellIdx) => {
        const r = shellRadii[shellIdx];
        const speed_i = 0.6 / (shellIdx + 1); // 안쪽일수록 빠름
        for (let j = 0; j < count; j++) {
          const baseAngle = (j / count) * Math.PI * 2;
          const angle = baseAngle + t * speed_i * (shellIdx % 2 === 0 ? 1 : -1);
          const ex = cx + Math.cos(angle) * r;
          const ey = cy + Math.sin(angle) * r;
          const isValence = shellIdx === shells.length - 1;

          ctx.beginPath();
          ctx.arc(ex, ey, (isValence ? 6 : 4.5) * scale, 0, Math.PI * 2);
          ctx.fillStyle = isValence ? '#ffdd55' : '#5599ff';
          ctx.shadowColor = isValence ? '#ffdd55' : '#5599ff';
          ctx.shadowBlur = (isValence ? 10 : 6) * scale;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // 핵
      const nucR = 26 * scale;
      const nucGrad = ctx.createRadialGradient(cx - nucR * 0.3, cy - nucR * 0.3, nucR * 0.1, cx, cy, nucR);
      nucGrad.addColorStop(0, lighten(atom.color, 60));
      nucGrad.addColorStop(1, darken(atom.color, 20));
      ctx.beginPath();
      ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
      ctx.fillStyle = nucGrad;
      ctx.shadowColor = atom.color;
      ctx.shadowBlur = 15 * scale;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isLight(atom.color) ? '#111' : '#fff';
      ctx.font = `bold ${14 * scale}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element, cx, cy);

      // 정보 박스
      drawInfoBox(ctx, atom, shells, W, H, scale);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
    };
  }, [element, playing, speed]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* 원소 선택 드롭다운 */}
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
          {element} ({ATOMS[element]?.name ?? '?'}) ▾
        </button>

        {showPicker && (
          <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
            <MiniCanvas
              onRecognize={handleMiniRecognize}
              onClose={() => { setShowPicker(false); setInputError(''); }}
              placeholder="원소 기호를 쓰세요 (예: Na)"
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
              {ELEMENT_PRESETS.map(p => (
                <button
                  key={p.symbol}
                  onClick={() => handleSelect(p.symbol)}
                  style={{
                    background: element === p.symbol ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                    border: `1px solid ${element === p.symbol ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                    borderRadius: 7, padding: '4px 8px',
                    color: element === p.symbol ? '#aaccff' : '#5577aa',
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
    </div>
  );
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0d1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  atom: (typeof ATOMS)[keyof typeof ATOMS],
  shells: number[],
  W: number, H: number, scale: number
) {
  const pad = 12 * scale;
  const boxH = 65 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(pad, H - boxH - pad, W - pad * 2, boxH, 8 * scale);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e8f4ff';
  ctx.font = `bold ${15 * scale}px sans-serif`;
  ctx.fillText(`${atom.symbol}  ${atom.name}  (원자번호 ${atom.atomicNumber})`, pad + 8 * scale, H - boxH - 2 * scale);

  ctx.fillStyle = '#a0c4ff';
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.fillText(
    `전자 배치: ${shells.join(', ')}   |   원자가 전자: ${shells[shells.length - 1]}개   |   전기음성도: ${atom.electronegativity}`,
    pad + 8 * scale, H - boxH + 20 * scale
  );

  // 전자 색상 범례
  ctx.beginPath();
  ctx.arc(pad + 14 * scale, H - boxH + 50 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#5599ff';
  ctx.fill();
  ctx.fillStyle = '#a0c4ff';
  ctx.font = `${11 * scale}px sans-serif`;
  ctx.fillText('내부 전자', pad + 22 * scale, H - boxH + 46 * scale);

  ctx.beginPath();
  ctx.arc(pad + 90 * scale, H - boxH + 50 * scale, 5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#ffdd55';
  ctx.fill();
  ctx.fillStyle = '#ffdd88';
  ctx.fillText('원자가 전자 (반응에 참여)', pad + 98 * scale, H - boxH + 46 * scale);
}

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
  if (c.length === 3)
    return [parseInt(c[0]+c[0],16), parseInt(c[1]+c[1],16), parseInt(c[2]+c[2],16)];
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}
