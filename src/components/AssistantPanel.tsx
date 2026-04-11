import type { ParseResult } from '../chemistry/types';

export interface AssistantItem {
  id: number;
  raw: string;
  clean: string;          // 깔끔하게 정리된 텍스트
  type: ParseResult['type'];
  description: string;
  time: string;           // HH:MM
}

interface Props {
  items: AssistantItem[];
}

// 숫자를 화학식 아래첨자로 변환: H2O → H₂O
function toCleanChem(text: string): string {
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

// ── 요약 생성 엔진 ──────────────────────────────────────────────────
// 화학식 → 한국어 이름 매핑
const FORMULA_NAME: Record<string, string> = {
  'H₂O':'물', 'NaCl':'염화나트륨(소금)', 'CO₂':'이산화탄소', 'NH₃':'암모니아',
  'CH₄':'메테인', 'HCl':'염화수소', 'H₂SO₄':'황산', 'NaOH':'수산화나트륨',
  'CaCO₃':'탄산칼슘', 'Fe₂O₃':'산화철(III)', 'C₆H₁₂O₆':'포도당',
  'N₂':'질소 기체', 'O₂':'산소 기체', 'H₂':'수소 기체', 'KOH':'수산화칼륨',
  'MgO':'산화마그네슘', 'CaO':'산화칼슘', 'AgCl':'염화은', 'CuO':'산화구리',
};

// 주제 키워드로 단원 추정
const UNIT_MAP: Record<string, string[]> = {
  '화학 결합':       ['ionic_bond', 'covalent_bond'],
  '산과 염기':       ['acid_base'],
  '산화환원 반응':   ['redox'],
  '화학 반응':       ['reaction'],
  '원자 구조':       ['electron_config'],
  '물질의 구성':     ['molecule'],
};

export function buildSummary(items: AssistantItem[]) {
  // 고유 항목 추출
  const uniqueByClean = (type: string) =>
    [...new Map(items.filter(i => i.type === type).map(i => [i.clean, i])).values()];
  const conceptTypes = ['ionic_bond','covalent_bond','acid_base','redox','electron_config'] as const;

  const molecules = uniqueByClean('molecule');
  const reactions = uniqueByClean('reaction');
  const concepts  = [...new Map(
    items.filter(i => (conceptTypes as readonly string[]).includes(i.type))
      .map(i => [i.type, i])
  ).values()];

  // 1. 수업 주제 추정
  const typeCounts: Record<string, number> = {};
  items.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] ?? 0) + 1; });
  const detectedUnits: string[] = [];
  for (const [unit, types] of Object.entries(UNIT_MAP)) {
    if (types.some(t => typeCounts[t])) detectedUnits.push(unit);
  }
  const mainTopic = detectedUnits.length > 0
    ? detectedUnits.join(', ')
    : '화학 수업';

  // 2. 요약 문단 생성
  const sentences: string[] = [];
  if (molecules.length > 0) {
    const names = molecules.slice(0, 4).map(m => {
      const name = FORMULA_NAME[m.clean];
      return name ? `${m.clean}(${name})` : m.clean;
    });
    const extra = molecules.length > 4 ? ` 외 ${molecules.length - 4}종` : '';
    sentences.push(`${names.join(', ')}${extra}의 분자 구조를 학습했습니다.`);
  }
  if (reactions.length > 0) {
    const types = [...new Set(reactions.map(r => r.description.split(':')[0].replace('반응식', '').trim()).filter(Boolean))];
    if (types.length > 0) {
      sentences.push(`${types.join(', ')} 등 ${reactions.length}개의 화학 반응을 다루었습니다.`);
    } else {
      sentences.push(`${reactions.length}개의 화학 반응식을 다루었습니다.`);
    }
  }
  if (concepts.length > 0) {
    const labels = concepts.map(c => TYPE_LABEL[c.type]?.label ?? c.type);
    sentences.push(`핵심 개념으로 ${labels.join(', ')}을(를) 학습했습니다.`);
  }

  // 3. 연관 관계 분석
  const connections: string[] = [];
  const hasIonic = typeCounts['ionic_bond'] > 0;
  const hasCovalent = typeCounts['covalent_bond'] > 0;
  const molCleans = molecules.map(m => m.clean);
  if (hasIonic && molCleans.some(m => ['NaCl','KCl','MgO','CaO','LiF','KF'].includes(m.replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))))) {
    connections.push('이온결합 화합물의 구조와 결합 원리를 함께 학습');
  }
  if (hasCovalent && molCleans.some(m => ['H₂O','NH₃','CH₄','CO₂'].includes(m))) {
    connections.push('공유결합 분자의 구조와 결합 원리를 함께 학습');
  }
  if (hasIonic && hasCovalent) {
    connections.push('이온결합과 공유결합의 차이를 비교 학습');
  }
  if (typeCounts['acid_base'] && typeCounts['reaction']) {
    connections.push('산염기 반응의 이론과 실제 반응식을 연계 학습');
  }

  // 4. 통계
  const totalRecognitions = items.length;
  const uniqueCount = molecules.length + reactions.length + concepts.length;
  const timeRange = items.length >= 2
    ? `${items[0].time} ~ ${items[items.length - 1].time}`
    : items.length === 1 ? items[0].time : '';

  return {
    mainTopic,
    sentences,
    connections,
    molecules, reactions, concepts,
    totalRecognitions, uniqueCount, timeRange,
  };
}

// ═════════════════════════════════════════════════════════════════════
export default function AssistantPanel({ items }: Props) {
  const summary = items.length > 0 ? buildSummary(items) : null;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#090e1a',
      borderLeft: '2px solid rgba(60,100,160,0.25)',
      overflow: 'hidden',
    }}>
      {/* 패널 제목 */}
      <div style={{
        padding: '6px 12px',
        fontSize: '12px', fontWeight: 600, color: '#5577aa',
        background: 'rgba(10,20,40,0.6)',
        borderBottom: '1px solid rgba(40,70,120,0.25)',
        flexShrink: 0, minHeight: '30px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span>🤖 수업 보조</span>
        {items.length > 0 && (
          <span style={{
            background: 'rgba(60,120,240,0.2)',
            border: '1px solid rgba(60,120,240,0.3)',
            borderRadius: '10px', padding: '1px 7px',
            fontSize: '10px', color: '#6699cc',
          }}>{items.length}건</span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#2a4060',
            padding: '30px 10px', lineHeight: 2,
          }}>
            <div style={{ fontSize: '28px', marginBottom: '10px', opacity: 0.5 }}>🤖</div>
            <div style={{ fontSize: '12px' }}>
              판서 후 <strong style={{ color: '#446688' }}>인식</strong> 버튼을 누르면<br />
              수업 내용이 자동으로 정리됩니다
            </div>
          </div>
        ) : summary && (
          <>
            {/* 섹션 1: 인식 내용 타임라인 */}
            <Section title="📋 인식 내용">
              {[...items].reverse().map(item => {
                const tag = TYPE_LABEL[item.type] ?? TYPE_LABEL.unknown;
                return (
                  <div key={item.id} style={{
                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                    padding: '6px 0',
                    borderBottom: '1px solid rgba(40,70,110,0.2)',
                  }}>
                    <span style={{ fontSize: '10px', color: '#334466', minWidth: '32px', paddingTop: '1px' }}>
                      {item.time}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', padding: '1px 6px',
                          borderRadius: '8px',
                          background: `${tag.color}22`,
                          border: `1px solid ${tag.color}44`,
                          color: tag.color,
                        }}>{tag.label}</span>
                        <span style={{
                          fontSize: '13px', fontWeight: 600,
                          color: '#c8e0ff', fontFamily: 'Courier New, monospace',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '130px',
                        }}>{item.clean}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#3a5870', marginTop: '2px' }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Section>

            {/* 섹션 2: 수업 요약 */}
            <Section title="📝 수업 요약">
              {/* 주제 */}
              <div style={{
                fontSize: '12px', fontWeight: 700, color: '#88bbff',
                padding: '6px 10px', marginBottom: '8px',
                background: 'rgba(40,80,180,0.15)', borderRadius: '8px',
                border: '1px solid rgba(60,120,240,0.2)',
              }}>
                주제: {summary.mainTopic}
              </div>
              {/* 요약 문단 */}
              {summary.sentences.length > 0 && (
                <div style={{
                  fontSize: '11px', color: '#8899bb', lineHeight: 1.8,
                  padding: '4px 0', marginBottom: '8px',
                }}>
                  {summary.sentences.map((s, i) => <div key={i}>{s}</div>)}
                </div>
              )}
              {/* 연관 관계 */}
              {summary.connections.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  {summary.connections.map((c, i) => (
                    <div key={i} style={{
                      fontSize: '10px', color: '#66aa88', padding: '2px 0',
                      display: 'flex', gap: '4px', alignItems: 'center',
                    }}>
                      <span style={{ color: '#44aa66' }}>&#x2192;</span> {c}
                    </div>
                  ))}
                </div>
              )}
              {/* 통계 */}
              <div style={{
                fontSize: '10px', color: '#445566', marginTop: '6px',
                display: 'flex', gap: '12px', flexWrap: 'wrap',
              }}>
                <span>인식 {summary.totalRecognitions}회</span>
                <span>고유 항목 {summary.uniqueCount}개</span>
                {summary.timeRange && <span>{summary.timeRange}</span>}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, color: '#3a5878',
        marginBottom: '6px', letterSpacing: '0.3px',
      }}>{title}</div>
      {children}
    </div>
  );
}

export { toCleanChem };
