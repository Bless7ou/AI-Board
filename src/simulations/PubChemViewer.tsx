import { useState, useEffect } from 'react';
import { fetchFromPubChem } from '../chemistry/PubChemAPI';
import type { MoleculeData } from '../chemistry/types';
import MoleculeViewer from './MoleculeViewer';

interface Props {
  formula: string;
  playing: boolean;
  speed: number;
}

export default function PubChemViewer({ formula, playing, speed }: Props) {
  const [molecule, setMolecule] = useState<MoleculeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setMolecule(null);

    fetchFromPubChem(formula)
      .then(data => setMolecule(data))
      .catch(e => setError(e instanceof Error ? e.message : 'PubChem 오류'))
      .finally(() => setLoading(false));
  }, [formula]);

  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#66aaff', textAlign: 'center',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '14px', animation: 'spin 1.5s linear infinite' }}>🔬</div>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>PubChem에서 검색 중...</div>
        <div style={{ fontSize: '12px', color: '#4488cc', marginTop: '6px' }}>{formula}</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#ff8866', textAlign: 'center', padding: '20px',
      }}>
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
