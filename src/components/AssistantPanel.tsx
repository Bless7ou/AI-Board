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

export default function AssistantPanel({ items }: Props) {
  // 오늘 요약 자동 생성
  const molecules = items.filter(i => i.type === 'molecule').map(i => i.clean);
  const concepts  = items.filter(i =>
    ['ionic_bond','covalent_bond','acid_base','redox','electron_config'].includes(i.type)
  ).map(i => i.description.split(' ')[0]);
  const reactions = items.filter(i => i.type === 'reaction').map(i => i.clean);

  const uniqueMolecules = [...new Set(molecules)];
  const uniqueConcepts  = [...new Set(concepts)];
  const uniqueReactions = [...new Set(reactions)];

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
          /* 초기 상태 */
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
        ) : (
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

            {/* 섹션 2: 오늘의 요약 */}
            <Section title="📝 오늘의 요약">
              {uniqueMolecules.length > 0 && (
                <SummaryRow label="다룬 화학식" items={uniqueMolecules} color="#4499ff" />
              )}
              {uniqueReactions.length > 0 && (
                <SummaryRow label="다룬 반응식" items={uniqueReactions} color="#ff9944" />
              )}
              {uniqueConcepts.length > 0 && (
                <SummaryRow label="다룬 개념" items={uniqueConcepts} color="#aa66ff" />
              )}
              {uniqueMolecules.length === 0 && uniqueReactions.length === 0 && uniqueConcepts.length === 0 && (
                <div style={{ fontSize: '11px', color: '#334466', padding: '4px 0' }}>
                  인식된 내용이 없습니다
                </div>
              )}
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

function SummaryRow({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', color: '#33556688', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: '12px', padding: '2px 8px',
            borderRadius: '10px',
            background: `${color}18`,
            border: `1px solid ${color}33`,
            color,
            fontFamily: 'Courier New, monospace',
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

export { toCleanChem };
