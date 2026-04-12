import { useState, useEffect, useCallback, useRef } from 'react';
import type { ParseResult } from '../chemistry/types';
import { ATOMS } from '../chemistry/atomData';

// ── 기존 exports (SummaryModal에서 계속 사용) ───────────────────────────────

export interface AssistantItem {
  id: number;
  raw: string;
  clean: string;
  type: ParseResult['type'];
  description: string;
  time: string;
}

export function toCleanChem(text: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return text
    .replace(/([A-Za-z\)])(\d+)/g, (_, pre, num: string) =>
      pre + num.split('').map(c => sub[+c]).join('')
    )
    .replace(/->/g, '→');
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  molecule:      { label: '분자',   color: '#4499ff' },
  reaction:      { label: '반응식', color: '#ff9944' },
  ionic_bond:    { label: '이온결합', color: '#aa66ff' },
  covalent_bond: { label: '공유결합', color: '#44ddaa' },
  electron_config:{ label: '전자배치', color: '#ffcc33' },
  acid_base:     { label: '산염기', color: '#ff6699' },
  redox:         { label: '산화환원', color: '#ff8844' },
  unknown:       { label: '기타',   color: '#778899' },
};

const FORMULA_NAME: Record<string, string> = {
  'H₂O':'물', 'NaCl':'염화나트륨(소금)', 'CO₂':'이산화탄소', 'NH₃':'암모니아',
  'CH₄':'메테인', 'HCl':'염화수소', 'H₂SO₄':'황산', 'NaOH':'수산화나트륨',
  'CaCO₃':'탄산칼슘', 'Fe₂O₃':'산화철(III)', 'C₆H₁₂O₆':'포도당',
  'N₂':'질소 기체', 'O₂':'산소 기체', 'H₂':'수소 기체', 'KOH':'수산화칼륨',
  'MgO':'산화마그네슘', 'CaO':'산화칼슘', 'AgCl':'염화은', 'CuO':'산화구리',
  'C₂H₅OH':'에탄올', 'CH₃COOH':'아세트산', 'KCl':'염화칼륨',
};

const FORMULA_INSIGHT: Record<string, string> = {
  'H₂O':'극성 분자로, 수소결합에 의해 높은 끓는점을 가짐',
  'NaCl':'대표적 이온결합 물질. Na⁺와 Cl⁻가 정전기적 인력으로 결합',
  'CO₂':'무극성 분자. 탄소와 산소가 이중결합으로 연결된 직선형 구조',
  'NH₃':'비공유 전자쌍을 가진 삼각뿔형 분자. 염기로 작용',
  'CH₄':'정사면체 구조의 무극성 분자. 가장 단순한 탄화수소',
  'HCl':'강산. 물에서 완전 이온화되어 H⁺와 Cl⁻ 생성',
  'NaOH':'강염기. 물에서 Na⁺와 OH⁻로 완전 이온화',
  'H₂SO₄':'이양성자산. 두 단계로 이온화되는 강산',
  'CaCO₃':'석회석의 주성분. 산과 반응하여 CO₂ 발생',
  'Fe₂O₃':'철의 산화물(녹). 산화환원 반응의 대표적 생성물',
};

const REACTION_INSIGHT: Record<string, string> = {
  '합성':'두 가지 이상의 물질이 결합하여 새로운 물질을 생성하는 반응',
  '분해':'하나의 화합물이 두 가지 이상의 물질로 분해되는 반응',
  '연소':'물질이 산소와 빠르게 반응하여 열과 빛을 내는 발열 반응',
  '중화':'산의 H⁺와 염기의 OH⁻가 만나 물을 생성하는 반응',
  '산화환원':'전자의 이동이 일어나는 반응. 산화와 환원은 항상 동시에 발생',
  '앙금':'두 수용액이 만나 불용성 고체(침전물)가 생성되는 반응',
};

const CONCEPT_KEY_POINTS: Record<string, string[]> = {
  ionic_bond: [
    '금속 + 비금속 원소 간 전자 이동으로 형성',
    '양이온과 음이온의 정전기적 인력',
    '높은 녹는점, 수용액 상태에서 전기 전도',
  ],
  covalent_bond: [
    '비금속 원소끼리 전자쌍을 공유하여 형성',
    '단일결합·이중결합·삼중결합으로 구분',
    '분자의 모양이 성질을 결정 (극성/무극성)',
  ],
  electron_config: [
    '전자는 에너지 준위가 낮은 껍질부터 채워짐',
    '최외각 전자(원자가 전자)가 화학적 성질을 결정',
    '옥텟 규칙: 최외각 전자 8개로 안정',
  ],
  acid_base: [
    '산: H⁺를 내놓는 물질 / 염기: OH⁻를 내놓는 물질',
    'pH < 7 산성, pH = 7 중성, pH > 7 염기성',
    '중화 반응: 산 + 염기 → 물 + 염',
  ],
  redox: [
    '산화: 전자를 잃는 것 / 환원: 전자를 얻는 것',
    '산화수 변화로 산화·환원 판별',
    '산화제는 자신이 환원되고, 환원제는 자신이 산화됨',
  ],
};

const UNIT_MAP: Record<string, string[]> = {
  '화학 결합':       ['ionic_bond', 'covalent_bond'],
  '산과 염기':       ['acid_base'],
  '산화환원 반응':   ['redox'],
  '화학 반응':       ['reaction'],
  '원자 구조':       ['electron_config'],
  '물질의 구성':     ['molecule'],
};

export function buildSummary(items: AssistantItem[]) {
  const uniqueByClean = (type: string) =>
    [...new Map(items.filter(i => i.type === type).map(i => [i.clean, i])).values()];
  const conceptTypes = ['ionic_bond','covalent_bond','acid_base','redox','electron_config'] as const;

  const molecules = uniqueByClean('molecule');
  const reactions = uniqueByClean('reaction');
  const concepts  = [...new Map(
    items.filter(i => (conceptTypes as readonly string[]).includes(i.type))
      .map(i => [i.type, i])
  ).values()];

  const typeCounts: Record<string, number> = {};
  items.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] ?? 0) + 1; });
  const detectedUnits: string[] = [];
  for (const [unit, types] of Object.entries(UNIT_MAP)) {
    if (types.some(t => typeCounts[t])) detectedUnits.push(unit);
  }
  const mainTopic = detectedUnits.length > 0 ? detectedUnits.join(', ') : '화학 수업';

  const flowParts: string[] = [];
  const typeOrder: string[] = [];
  items.forEach(i => {
    if (typeOrder.length === 0 || typeOrder[typeOrder.length - 1] !== i.type) {
      typeOrder.push(i.type);
    }
  });

  if (typeOrder.length > 0) {
    const first = items[0];
    const firstLabel = TYPE_LABEL[first.type]?.label ?? '화학';
    const firstName = FORMULA_NAME[first.clean] ? `${first.clean}(${FORMULA_NAME[first.clean]})` : first.clean;
    flowParts.push(`${firstName}${first.type === 'molecule' ? '의 구조 관찰' : first.type === 'reaction' ? ' 반응' : ` — ${firstLabel}`}(으)로 수업을 시작했습니다.`);
  }

  if (typeOrder.length >= 2) {
    const mid = items.slice(1, -1);
    const midTypes = [...new Set(mid.map(i => TYPE_LABEL[i.type]?.label).filter(Boolean))];
    if (midTypes.length > 0) {
      flowParts.push(`이후 ${midTypes.join(', ')} 내용을 다루며 학습을 전개했습니다.`);
    }
  }

  if (items.length >= 3) {
    const last = items[items.length - 1];
    const lastLabel = TYPE_LABEL[last.type]?.label ?? '화학';
    flowParts.push(`마지막으로 ${lastLabel} 관련 내용을 정리하며 마무리했습니다.`);
  }

  const keyPoints: { title: string; points: string[] }[] = [];

  if (molecules.length > 0) {
    const molPoints: string[] = [];
    molecules.forEach(m => {
      const name = FORMULA_NAME[m.clean];
      const insight = FORMULA_INSIGHT[m.clean];
      if (insight) {
        molPoints.push(`${m.clean}${name ? `(${name})` : ''}: ${insight}`);
      } else if (name) {
        molPoints.push(`${m.clean} — ${name}`);
      }
    });
    if (molPoints.length > 0) {
      keyPoints.push({ title: '다룬 물질', points: molPoints });
    }
  }

  if (reactions.length > 0) {
    const rxnPoints: string[] = [];
    const rxnTypes = new Set<string>();
    reactions.forEach(r => {
      const t = r.description.split(':')[0].replace('반응식', '').trim();
      if (t && !rxnTypes.has(t)) {
        rxnTypes.add(t);
        const insight = REACTION_INSIGHT[t];
        if (insight) rxnPoints.push(`${t} 반응: ${insight}`);
      }
    });
    if (rxnPoints.length > 0) {
      keyPoints.push({ title: '반응 유형', points: rxnPoints });
    }
  }

  if (concepts.length > 0) {
    concepts.forEach(c => {
      const pts = CONCEPT_KEY_POINTS[c.type];
      const label = TYPE_LABEL[c.type]?.label ?? c.type;
      if (pts) {
        keyPoints.push({ title: `${label} 핵심`, points: pts });
      }
    });
  }

  const connections: string[] = [];
  const hasIonic = typeCounts['ionic_bond'] > 0;
  const hasCovalent = typeCounts['covalent_bond'] > 0;
  const molCleans = molecules.map(m => m.clean);

  if (hasIonic && hasCovalent) {
    connections.push('이온결합과 공유결합을 비교하며 화학 결합의 본질을 이해');
  }
  if (hasIonic && molCleans.some(m => ['NaCl','KCl','MgO','CaO'].includes(m))) {
    connections.push('이온결합 이론을 실제 화합물 구조와 연결하여 학습');
  }
  if (hasCovalent && molCleans.some(m => ['H₂O','NH₃','CH₄','CO₂'].includes(m))) {
    connections.push('공유결합 원리를 분자 구조 관찰로 확인');
  }
  if (typeCounts['acid_base'] && typeCounts['reaction']) {
    connections.push('산염기 개념과 실제 중화 반응식을 연계하여 이해');
  }
  if (typeCounts['redox'] && typeCounts['reaction']) {
    connections.push('산화환원 개념을 실제 반응식에 적용하여 분석');
  }
  if (typeCounts['electron_config'] && (hasIonic || hasCovalent)) {
    connections.push('전자 배치 → 원자가 전자 → 결합 형성의 흐름을 이해');
  }

  const totalRecognitions = items.length;
  const uniqueCount = molecules.length + reactions.length + concepts.length;
  const timeRange = items.length >= 2
    ? `${items[0].time} ~ ${items[items.length - 1].time}`
    : items.length === 1 ? items[0].time : '';

  return {
    mainTopic,
    flowParts,
    keyPoints,
    connections,
    molecules, reactions, concepts,
    totalRecognitions, uniqueCount, timeRange,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 화학 도구 데이터
// ═══════════════════════════════════════════════════════════════════════

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81,
  C: 12.01, N: 14.01, O: 16.00, F: 19.00, Ne: 20.18,
  Na: 22.99, Mg: 24.31, Al: 26.98, Si: 28.09, P: 30.97,
  S: 32.07, Cl: 35.45, Ar: 39.95, K: 39.10, Ca: 40.08,
  Sc: 44.96, Ti: 47.87, V: 50.94, Cr: 52.00, Mn: 54.94,
  Fe: 55.85, Co: 58.93, Ni: 58.69, Cu: 63.55, Zn: 65.38,
  Ga: 69.72, Ge: 72.63, As: 74.92, Se: 78.97, Br: 79.90, Kr: 83.80,
  Rb: 85.47, Sr: 87.62, Ag: 107.87, Sn: 118.71, I: 126.90, Xe: 131.29,
  Ba: 137.33, W: 183.84, Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2,
};

const PT_LAYOUT: [string, number, number][] = [
  ['H',1,1],['He',1,18],
  ['Li',2,1],['Be',2,2],['B',2,13],['C',2,14],['N',2,15],['O',2,16],['F',2,17],['Ne',2,18],
  ['Na',3,1],['Mg',3,2],['Al',3,13],['Si',3,14],['P',3,15],['S',3,16],['Cl',3,17],['Ar',3,18],
  ['K',4,1],['Ca',4,2],['Sc',4,3],['Ti',4,4],['V',4,5],['Cr',4,6],['Mn',4,7],['Fe',4,8],
  ['Co',4,9],['Ni',4,10],['Cu',4,11],['Zn',4,12],['Ga',4,13],['Ge',4,14],['As',4,15],['Se',4,16],['Br',4,17],['Kr',4,18],
];

function getElemCategory(sym: string): { bg: string; border: string } {
  const a = ATOMS[sym];
  if (!a) return { bg: '#1a2030', border: '#334' };
  const n = a.atomicNumber;
  if (['H','C','N','O','F','P','S','Cl','Se','Br','I'].includes(sym))
    return { bg: 'rgba(60,180,100,0.15)', border: 'rgba(60,180,100,0.4)' };
  if (['He','Ne','Ar','Kr','Xe'].includes(sym))
    return { bg: 'rgba(120,80,200,0.15)', border: 'rgba(120,80,200,0.4)' };
  if (['Li','Na','K','Rb','Cs'].includes(sym))
    return { bg: 'rgba(220,80,80,0.15)', border: 'rgba(220,80,80,0.4)' };
  if (['Be','Mg','Ca','Sr','Ba'].includes(sym))
    return { bg: 'rgba(220,160,40,0.15)', border: 'rgba(220,160,40,0.4)' };
  if (n >= 21 && n <= 30)
    return { bg: 'rgba(60,120,220,0.15)', border: 'rgba(60,120,220,0.4)' };
  if (['B','Si','Al'].includes(sym))
    return { bg: 'rgba(100,180,220,0.15)', border: 'rgba(100,180,220,0.4)' };
  return { bg: '#1a2030', border: '#334' };
}

// ═══════════════════════════════════════════════════════════════════════
// 메인 패널
// ═══════════════════════════════════════════════════════════════════════

type Tool = 'periodic' | 'calc' | 'timer';

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'periodic', icon: '&#x1F9EA;', label: '주기율표' },   // 🧪
  { id: 'calc',     icon: '&#x1F5A9;', label: '계산기' },     // 🖩
  { id: 'timer',    icon: '&#x23F1;',  label: '타이머' },     // ⏱
];

interface Props {
  items: AssistantItem[];
}

export default function AssistantPanel({ items: _items }: Props) {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#090e1a',
      borderLeft: '2px solid rgba(60,100,160,0.25)',
      overflow: 'hidden',
    }}>
      {/* 상단 아이콘 바 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '4px',
        padding: '8px 6px',
        background: 'rgba(10,20,40,0.6)',
        borderBottom: '1px solid rgba(40,70,120,0.25)',
        flexShrink: 0,
      }}>
        {TOOLS.map(t => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(isActive ? null : t.id)}
              title={t.label}
              style={{
                width: 44, height: 44,
                display: 'flex', flexDirection: 'column',
                justifyContent: 'center', alignItems: 'center',
                gap: '2px',
                border: isActive ? '1.5px solid #4488cc' : '1.5px solid rgba(40,70,120,0.3)',
                borderRadius: '10px',
                cursor: 'pointer',
                background: isActive ? 'rgba(40,80,200,0.25)' : 'rgba(15,25,50,0.5)',
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{ fontSize: '18px', lineHeight: 1 }}
                dangerouslySetInnerHTML={{ __html: t.icon }}
              />
              <span style={{
                fontSize: '7px', fontWeight: 600,
                color: isActive ? '#88bbff' : '#445566',
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {activeTool === null && <ToolHome />}
        {activeTool === 'periodic' && <PeriodicTool />}
        {activeTool === 'calc' && <CalcTool />}
        {activeTool === 'timer' && <TimerTool />}
      </div>
    </div>
  );
}

// ── 홈 (아무것도 선택 안 했을 때) ──────────────────────────────────────

function ToolHome() {
  return (
    <div style={{
      textAlign: 'center', color: '#2a4060',
      padding: '40px 10px', lineHeight: 2,
    }}>
      <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>&#x1F9EA;</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#446688', marginBottom: '6px' }}>
        화학 도구 모음
      </div>
      <div style={{ fontSize: '11px', color: '#334455' }}>
        위 아이콘을 선택하면<br />도구가 열립니다
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1. 주기율표
// ═══════════════════════════════════════════════════════════════════════

function PeriodicTool() {
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const selAtom = selectedEl ? ATOMS[selectedEl] : null;

  return (
    <>
      {/* 범례 */}
      <div style={{
        display: 'flex', gap: '6px', flexWrap: 'wrap',
        marginBottom: '8px', padding: '4px 0',
      }}>
        {[
          ['비금속', 'rgba(60,180,100,0.5)'],
          ['알칼리', 'rgba(220,80,80,0.5)'],
          ['알칼리토', 'rgba(220,160,40,0.5)'],
          ['전이금속', 'rgba(60,120,220,0.5)'],
          ['비활성기체', 'rgba(120,80,200,0.5)'],
        ].map(([label, color]) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8px', color: '#667788',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(18, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gap: '2px', marginBottom: '10px',
      }}>
        {PT_LAYOUT.map(([sym, row, col]) => {
          const cat = getElemCategory(sym);
          const atom = ATOMS[sym];
          const isSel = selectedEl === sym;
          return (
            <div key={sym} onClick={() => setSelectedEl(isSel ? null : sym)} style={{
              gridRow: row, gridColumn: col,
              padding: '2px 1px', textAlign: 'center', cursor: 'pointer',
              borderRadius: '4px',
              border: `1px solid ${isSel ? '#4488ff' : cat.border}`,
              background: isSel ? 'rgba(40,80,200,0.35)' : cat.bg,
              transition: 'all 0.12s',
              minHeight: '32px',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <div style={{ fontSize: '7px', color: '#556677', lineHeight: 1 }}>
                {atom?.atomicNumber ?? ''}
              </div>
              <div style={{
                fontSize: '11px', fontWeight: 700,
                color: isSel ? '#aaccff' : (atom?.color ?? '#aaa'),
                lineHeight: 1.2,
              }}>{sym}</div>
            </div>
          );
        })}
      </div>

      {/* 원소 상세 */}
      {selAtom ? (
        <div style={{
          background: 'rgba(20,40,80,0.4)',
          border: '1px solid rgba(60,120,220,0.3)',
          borderRadius: '8px', padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '8px',
              background: `${selAtom.color}22`, border: `2px solid ${selAtom.color}66`,
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <span style={{ fontSize: '7px', color: '#667' }}>{selAtom.atomicNumber}</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: selAtom.color, lineHeight: 1 }}>
                {selAtom.symbol}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#c8e0ff' }}>{selAtom.name}</div>
              <div style={{ fontSize: '10px', color: '#556677' }}>{selAtom.symbol}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <InfoBox label="원자번호" value={`${selAtom.atomicNumber}`} />
            <InfoBox label="원자량" value={ATOMIC_MASS[selAtom.symbol] ? `${ATOMIC_MASS[selAtom.symbol]}` : '-'} />
            <InfoBox label="전기음성도" value={selAtom.electronegativity > 0 ? `${selAtom.electronegativity}` : '-'} />
            <InfoBox label="원자가 전자" value={`${selAtom.valenceElectrons}개`} />
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#2a4060', padding: '14px 8px', fontSize: '11px' }}>
          원소를 클릭하면 상세 정보를 볼 수 있습니다
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// 3. 일반 계산기
// ═══════════════════════════════════════════════════════════════════════

function CalcTool() {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true); // 다음 숫자 입력 시 display 초기화

  const input = useCallback((ch: string) => {
    if (ch === 'C') {
      setDisplay('0'); setPrevVal(null); setOp(null); setFresh(true);
      return;
    }
    if (ch === '⌫') {
      setDisplay(d => d.length <= 1 ? '0' : d.slice(0, -1));
      return;
    }
    if (ch === '±') {
      setDisplay(d => d.startsWith('-') ? d.slice(1) : (d === '0' ? d : '-' + d));
      return;
    }

    // 연산자
    if (['+', '-', '×', '÷'].includes(ch)) {
      const cur = parseFloat(display);
      if (prevVal !== null && op && !fresh) {
        const res = evaluate(prevVal, op, cur);
        setDisplay(formatNum(res));
        setPrevVal(res);
      } else {
        setPrevVal(cur);
      }
      setOp(ch);
      setFresh(true);
      return;
    }

    // =
    if (ch === '=') {
      if (prevVal !== null && op) {
        const cur = parseFloat(display);
        const res = evaluate(prevVal, op, cur);
        setDisplay(formatNum(res));
        setPrevVal(null);
        setOp(null);
        setFresh(true);
      }
      return;
    }

    // 숫자 / 소수점
    if (ch === '.' && display.includes('.')) return;
    if (fresh) {
      setDisplay(ch === '.' ? '0.' : ch);
      setFresh(false);
    } else {
      setDisplay(d => (d === '0' && ch !== '.') ? ch : d + ch);
    }
  }, [display, prevVal, op, fresh]);

  const buttons = [
    ['C', '⌫', '±', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  return (
    <div>
      {/* 디스플레이 */}
      <div style={{
        background: 'rgba(10,20,50,0.6)', borderRadius: '10px',
        padding: '12px 14px', marginBottom: '8px',
        border: '1px solid rgba(40,70,120,0.25)',
      }}>
        {op && (
          <div style={{ fontSize: '10px', color: '#445566', textAlign: 'right', marginBottom: '2px' }}>
            {prevVal} {op}
          </div>
        )}
        <div style={{
          fontSize: '28px', fontWeight: 700, color: '#c8e0ff',
          textAlign: 'right', fontFamily: 'Courier New, monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {display}
        </div>
      </div>

      {/* 버튼 그리드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {buttons.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: '4px' }}>
            {row.map(ch => {
              const isOp = ['+', '-', '×', '÷'].includes(ch);
              const isEq = ch === '=';
              const isFunc = ['C', '⌫', '±'].includes(ch);
              const isZero = ch === '0';
              return (
                <button key={ch} onClick={() => input(ch)} style={{
                  flex: isZero ? 2 : 1,
                  padding: '12px 0',
                  fontSize: '16px', fontWeight: 600,
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  background: isEq ? 'rgba(40,120,220,0.4)'
                    : isOp ? 'rgba(220,160,40,0.2)'
                    : isFunc ? 'rgba(60,80,120,0.25)'
                    : 'rgba(20,35,65,0.6)',
                  color: isEq ? '#88ccff'
                    : isOp ? '#ffcc66'
                    : isFunc ? '#88aacc'
                    : '#c8e0ff',
                  transition: 'all 0.1s',
                }}>
                  {ch}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function evaluate(a: number, op: string, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : 0;
    default: return b;
  }
}

function formatNum(n: number): string {
  if (!isFinite(n)) return 'Error';
  const s = parseFloat(n.toPrecision(10)).toString();
  return s.length > 14 ? n.toExponential(6) : s;
}

// ═══════════════════════════════════════════════════════════════════════
// 4. 타이머
// ═══════════════════════════════════════════════════════════════════════

function TimerTool() {
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch');
  const [elapsed, setElapsed] = useState(0);       // ms
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number>(0);
  const startRef = useRef(0);
  const offsetRef = useRef(0);

  // 카운트다운 설정값 (초)
  const [countdownSet, setCountdownSet] = useState(300); // 기본 5분
  const [countdownLeft, setCountdownLeft] = useState(300);
  const countdownRunning = useRef(false);
  const cdIntervalRef = useRef<number>(0);
  const cdStartRef = useRef(0);
  const cdOffsetRef = useRef(0);

  // ── 스톱워치 ──
  const swStart = useCallback(() => {
    if (running) return;
    setRunning(true);
    startRef.current = performance.now();
    offsetRef.current = elapsed;
    intervalRef.current = window.setInterval(() => {
      setElapsed(offsetRef.current + (performance.now() - startRef.current));
    }, 50);
  }, [running, elapsed]);

  const swStop = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  const swReset = useCallback(() => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setElapsed(0);
    offsetRef.current = 0;
  }, []);

  // ── 카운트다운 ──
  const cdStart = useCallback(() => {
    if (countdownRunning.current) return;
    countdownRunning.current = true;
    cdStartRef.current = performance.now();
    cdOffsetRef.current = countdownLeft;
    cdIntervalRef.current = window.setInterval(() => {
      const left = cdOffsetRef.current - (performance.now() - cdStartRef.current) / 1000;
      if (left <= 0) {
        setCountdownLeft(0);
        clearInterval(cdIntervalRef.current);
        countdownRunning.current = false;
      } else {
        setCountdownLeft(left);
      }
    }, 50);
    // force re-render
    setCountdownLeft(l => l);
  }, [countdownLeft]);

  const cdStop = useCallback(() => {
    countdownRunning.current = false;
    clearInterval(cdIntervalRef.current);
    setCountdownLeft(l => l); // force re-render
  }, []);

  const cdReset = useCallback(() => {
    countdownRunning.current = false;
    clearInterval(cdIntervalRef.current);
    setCountdownLeft(countdownSet);
  }, [countdownSet]);

  // cleanup
  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(cdIntervalRef.current);
    };
  }, []);

  const fmtTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const fmtCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const presetTimes = [60, 180, 300, 600, 900]; // 1,3,5,10,15분
  const presetLabels = ['1분', '3분', '5분', '10분', '15분'];

  return (
    <div>
      {/* 모드 선택 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['stopwatch', 'countdown'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '7px 0', cursor: 'pointer',
            fontSize: '11px', fontWeight: 600, borderRadius: '8px',
            background: mode === m ? 'rgba(40,80,180,0.25)' : 'rgba(15,25,50,0.5)',
            color: mode === m ? '#88bbff' : '#445566',
            border: mode === m ? '1px solid rgba(60,120,220,0.4)' : '1px solid rgba(40,70,120,0.2)',
            transition: 'all 0.15s',
          }}>
            {m === 'stopwatch' ? '스톱워치' : '카운트다운'}
          </button>
        ))}
      </div>

      {mode === 'stopwatch' ? (
        <>
          {/* 스톱워치 디스플레이 */}
          <div style={{
            textAlign: 'center', padding: '20px 10px', marginBottom: '12px',
            background: 'rgba(10,20,50,0.5)', borderRadius: '12px',
            border: '1px solid rgba(40,70,120,0.25)',
          }}>
            <div style={{
              fontSize: '36px', fontWeight: 700, color: '#c8e0ff',
              fontFamily: 'Courier New, monospace', letterSpacing: '2px',
            }}>
              {fmtTime(elapsed)}
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {!running ? (
              <TimerBtn label="시작" color="#44aa66" onClick={swStart} />
            ) : (
              <TimerBtn label="정지" color="#cc6644" onClick={swStop} />
            )}
            <TimerBtn label="초기화" color="#556677" onClick={swReset} />
          </div>
        </>
      ) : (
        <>
          {/* 카운트다운 디스플레이 */}
          <div style={{
            textAlign: 'center', padding: '20px 10px', marginBottom: '12px',
            background: countdownLeft <= 0
              ? 'rgba(200,60,40,0.15)'
              : 'rgba(10,20,50,0.5)',
            borderRadius: '12px',
            border: countdownLeft <= 0
              ? '1px solid rgba(220,80,60,0.4)'
              : '1px solid rgba(40,70,120,0.25)',
            transition: 'all 0.3s',
          }}>
            <div style={{
              fontSize: '36px', fontWeight: 700,
              color: countdownLeft <= 0 ? '#ff6644' : '#c8e0ff',
              fontFamily: 'Courier New, monospace', letterSpacing: '2px',
            }}>
              {countdownLeft <= 0 ? '00:00' : fmtCountdown(countdownLeft)}
            </div>
            {countdownLeft <= 0 && (
              <div style={{ fontSize: '12px', color: '#ff8866', marginTop: '6px', fontWeight: 600 }}>
                시간 종료!
              </div>
            )}
          </div>

          {/* 직접 입력 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '10px', justifyContent: 'center',
          }}>
            <input
              type="number" min={0} max={99}
              value={String(Math.floor(countdownSet / 60))}
              onChange={e => {
                const m = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
                const s = countdownSet % 60;
                const v = m * 60 + s;
                setCountdownSet(v);
                setCountdownLeft(v);
              }}
              style={{
                width: '44px', padding: '6px 4px', textAlign: 'center',
                fontSize: '16px', fontWeight: 700, fontFamily: 'Courier New, monospace',
                background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(60,120,220,0.3)',
                borderRadius: '8px', color: '#c8e0ff', outline: 'none',
              }}
            />
            <span style={{ fontSize: '12px', color: '#556677', fontWeight: 600 }}>분</span>
            <input
              type="number" min={0} max={59}
              value={String(countdownSet % 60)}
              onChange={e => {
                const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                const m = Math.floor(countdownSet / 60);
                const v = m * 60 + s;
                setCountdownSet(v);
                setCountdownLeft(v);
              }}
              style={{
                width: '44px', padding: '6px 4px', textAlign: 'center',
                fontSize: '16px', fontWeight: 700, fontFamily: 'Courier New, monospace',
                background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(60,120,220,0.3)',
                borderRadius: '8px', color: '#c8e0ff', outline: 'none',
              }}
            />
            <span style={{ fontSize: '12px', color: '#556677', fontWeight: 600 }}>초</span>
          </div>

          {/* 프리셋 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {presetTimes.map((t, i) => (
              <button key={t} onClick={() => { setCountdownSet(t); setCountdownLeft(t); }} style={{
                flex: 1, padding: '5px 0', border: '1px solid rgba(60,120,180,0.25)',
                borderRadius: '8px', cursor: 'pointer',
                fontSize: '10px', fontWeight: 600,
                background: countdownSet === t ? 'rgba(40,80,180,0.3)' : 'rgba(20,30,60,0.5)',
                color: countdownSet === t ? '#88bbff' : '#556677',
              }}>{presetLabels[i]}</button>
            ))}
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {!countdownRunning.current && countdownLeft > 0 ? (
              <TimerBtn label="시작" color="#44aa66" onClick={cdStart} />
            ) : countdownLeft > 0 ? (
              <TimerBtn label="정지" color="#cc6644" onClick={cdStop} />
            ) : null}
            <TimerBtn label="초기화" color="#556677" onClick={cdReset} />
          </div>
        </>
      )}
    </div>
  );
}

function TimerBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px',
      cursor: 'pointer', fontSize: '13px', fontWeight: 600,
      background: `${color}33`, color, transition: 'all 0.12s',
    }}>{label}</button>
  );
}

// ── 공통 ────────────────────────────────────────────────────────────────

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(10,20,40,0.5)' }}>
      <div style={{ fontSize: '8px', color: '#445566' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#88aacc' }}>{value}</div>
    </div>
  );
}

export { TYPE_LABEL };
