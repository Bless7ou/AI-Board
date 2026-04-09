import type { ParseResult } from '../chemistry/types';
import PubChemViewer from './PubChemViewer';
import IonicBondSim from './IonicBondSim';
import CovalentBondSim from './CovalentBondSim';
import ElectronConfigSim from './ElectronConfigSim';
import AcidBaseSim from './AcidBaseSim';
import ReactionSim from './ReactionSim';

interface Props {
  result: ParseResult | null;
  playing: boolean;
  speed: number;
}

export default function SimulationPanel({ result, playing, speed }: Props) {
  if (!result) {
    return <Placeholder />;
  }

  switch (result.type) {
    case 'molecule':
      if (result.formula) {
        return <PubChemViewer formula={result.formula} playing={playing} speed={speed} />;
      }
      return <NoData message={result.description} />;

    case 'ionic_bond':
      return <IonicBondSim playing={playing} speed={speed} />;

    case 'covalent_bond':
      return <CovalentBondSim playing={playing} speed={speed} />;

    case 'electron_config':
      return (
        <ElectronConfigSim
          element={result.element ?? 'H'}
          playing={playing}
          speed={speed}
        />
      );

    case 'acid_base':
      return <AcidBaseSim playing={playing} speed={speed} />;

    case 'reaction':
      return (
        <ReactionSim
          equation={result.reaction?.equation ?? result.raw}
          reactionType={result.reaction?.type ?? 'synthesis'}
          playing={playing}
          speed={speed}
        />
      );

    case 'redox':
      return <RedoxPlaceholder />;

    case 'unknown':
    default:
      return <NoData message={result.description} />;
  }
}

function Placeholder() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#4a6080', textAlign: 'center', padding: '20px',
    }}>
      <div style={{ fontSize: '52px', marginBottom: '16px', opacity: 0.4 }}>⚗️</div>
      <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#5a7090' }}>
        판서 후 [인식] 버튼을 눌러주세요
      </div>
      <div style={{ fontSize: '12px', color: '#3a5060', lineHeight: 1.6 }}>
        화학식, 반응식, 키워드를 인식하여<br />
        자동으로 시뮬레이션을 생성합니다
      </div>
      <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {['H₂O', 'NaCl', '이온결합', '공유결합', '2H₂+O₂→2H₂O', '산염기', 'Na'].map((ex) => (
          <span key={ex} style={{
            background: 'rgba(80,120,180,0.15)',
            border: '1px solid rgba(80,120,180,0.25)',
            borderRadius: '12px',
            padding: '4px 12px',
            fontSize: '12px',
            color: '#6080a0',
          }}>
            {ex}
          </span>
        ))}
      </div>
    </div>
  );
}

function NoData({ message }: { message: string }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#ff8866', textAlign: 'center', padding: '20px',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
      <div style={{ fontSize: '14px', color: '#ff9977' }}>{message}</div>
      <div style={{ fontSize: '11px', color: '#996655', marginTop: '8px' }}>
        화학식을 더 크고 명확하게 써주세요
      </div>
    </div>
  );
}

function RedoxPlaceholder() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: '#88aaff', textAlign: 'center', padding: '20px',
      background: 'linear-gradient(180deg, #0a0a1a, #0d1a2e)',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
      <div style={{ fontSize: '16px', fontWeight: 600 }}>산화환원 반응</div>
      <div style={{ fontSize: '12px', color: '#5588cc', marginTop: '8px', lineHeight: 1.7 }}>
        산화: 전자를 잃는 반응 (산화수 증가)<br />
        환원: 전자를 얻는 반응 (산화수 감소)<br />
        <br />
        예: Zn + CuSO₄ → ZnSO₄ + Cu<br />
        Zn → Zn²⁺ + 2e⁻ (산화)<br />
        Cu²⁺ + 2e⁻ → Cu (환원)
      </div>
    </div>
  );
}
