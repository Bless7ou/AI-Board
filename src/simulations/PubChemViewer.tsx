import { useState, useEffect, useCallback } from 'react';
import { fetchFromPubChem } from '../chemistry/PubChemAPI';
import type { MoleculeData } from '../chemistry/types';
import MoleculeViewer from './MoleculeViewer';
import MiniCanvas from '../components/MiniCanvas';

interface Props {
  formula: string;
  playing: boolean;
  speed: number;
}

const PRESETS: { label: string; formula: string }[] = [
  { label: 'H₂O',      formula: 'H2O' },
  { label: 'CO₂',      formula: 'CO2' },
  { label: 'NH₃',      formula: 'NH3' },
  { label: 'CH₄',      formula: 'CH4' },
  { label: 'C₂H₅OH',  formula: 'C2H5OH' },
  { label: 'C₆H₁₂O₆', formula: 'C6H12O6' },
  { label: 'CaCO₃',    formula: 'CaCO3' },
  { label: 'Fe₂O₃',    formula: 'Fe2O3' },
];

function toSubFormula(formula: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return formula.replace(/(\d+)/g, (_, n: string) => n.split('').map((c: string) => sub[+c]).join(''));
}

export default function PubChemViewer({ formula: initialFormula, playing, speed }: Props) {
  const [formula, setFormula] = useState(initialFormula);
  const [molecule, setMolecule] = useState<MoleculeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => { setFormula(initialFormula); }, [initialFormula]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setMolecule(null);

    fetchFromPubChem(formula)
      .then(data => setMolecule(data))
      .catch(e => setError(e instanceof Error ? e.message : 'PubChem 오류'))
      .finally(() => setLoading(false));
  }, [formula]);

  const handleSelect = useCallback((f: string) => {
    setFormula(f);
    setShowPicker(false);
    setInputError('');
  }, []);

  const handleMiniRecognize = useCallback((text: string) => {
    const clean = text.replace(/\s+/g, '').replace(/[₀-₉]/g, c => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)));
    if (/^[A-Za-z0-9()]+$/.test(clean)) {
      handleSelect(clean);
    } else {
      setInputError(`"${text}" — 유효한 화학식이 아닙니다`);
    }
  }, [handleSelect]);

  // 드롭다운 UI
  const pickerUI = (
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
        {toSubFormula(formula)} ▾
      </button>

      {showPicker && (
        <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 10 }}>
          <MiniCanvas
            onRecognize={handleMiniRecognize}
            onClose={() => { setShowPicker(false); setInputError(''); }}
            placeholder="분자식을 쓰세요 (예: H2O)"
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
            {PRESETS.map(p => (
              <button
                key={p.formula}
                onClick={() => handleSelect(p.formula)}
                style={{
                  background: formula === p.formula ? 'rgba(60,120,255,0.35)' : 'rgba(20,40,80,0.5)',
                  border: `1px solid ${formula === p.formula ? 'rgba(80,160,255,0.6)' : 'rgba(40,70,130,0.4)'}`,
                  borderRadius: 7, padding: '4px 8px',
                  color: formula === p.formula ? '#aaccff' : '#5577aa',
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
  );

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#66aaff', textAlign: 'center',
      }}>
        {pickerUI}
        <div style={{ fontSize: '36px', marginBottom: '14px', animation: 'spin 1.5s linear infinite' }}>🔬</div>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>PubChem에서 검색 중...</div>
        <div style={{ fontSize: '12px', color: '#4488cc', marginTop: '6px' }}>{toSubFormula(formula)}</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#ff8866', textAlign: 'center', padding: '20px',
      }}>
        {pickerUI}
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
        <div style={{ fontSize: '14px', color: '#ff9977' }}>{error}</div>
        <div style={{ fontSize: '11px', color: '#996655', marginTop: '8px', lineHeight: 1.6 }}>
          PubChem에 등록된 화학식인지 확인해주세요.<br />
          예: C6H12O6, Fe2O3, CaCO3
        </div>
      </div>
    );
  }

  if (!molecule) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MoleculeViewer molecule={molecule} playing={playing} speed={speed} />
      {pickerUI}
      <div style={{
        position: 'absolute', top: '8px', right: '10px',
        background: 'rgba(0,80,160,0.5)',
        border: '1px solid rgba(80,160,255,0.3)',
        borderRadius: '8px', padding: '3px 9px',
        fontSize: '10px', color: '#88ccff',
      }}>
        PubChem
      </div>
    </div>
  );
}
