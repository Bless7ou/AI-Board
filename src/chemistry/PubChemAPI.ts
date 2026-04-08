import type { MoleculeData, Bond } from './types';

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

// 원자번호 → 원소 기호 맵
const ATOMIC_NUM_TO_SYMBOL: Record<number, string> = {
  1: 'H',  2: 'He', 3: 'Li',  4: 'Be', 5: 'B',   6: 'C',  7: 'N',
  8: 'O',  9: 'F',  10: 'Ne', 11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si',
  15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar', 19: 'K',  20: 'Ca', 26: 'Fe',
  27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn', 35: 'Br', 36: 'Kr',
  47: 'Ag', 53: 'I',  54: 'Xe', 79: 'Au', 80: 'Hg', 82: 'Pb',
};

// PubChem JSON 레코드 타입 정의
interface PubChemRecord {
  PC_Compounds: Array<{
    id: { id: { cid: number } };
    atoms: {
      aid: number[];
      element: number[];
    };
    bonds?: {
      aid1: number[];
      aid2: number[];
      order: number[];
    };
    coords?: Array<{
      aid: number[];
      conformers: Array<{ x: number[]; y: number[] }>;
    }>;
    props?: Array<{
      urn: { label: string; name?: string };
      value: { sval?: string; fval?: number; ival?: number };
    }>;
  }>;
}

// 메모리 캐시 (같은 화학식 중복 요청 방지)
const cache = new Map<string, MoleculeData>();

export async function fetchFromPubChem(formula: string): Promise<MoleculeData> {
  if (cache.has(formula)) return cache.get(formula)!;

  const encoded = encodeURIComponent(formula);
  const url = `${BASE}/name/${encoded}/record/JSON?record_type=2d`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`"${formula}" 분자를 PubChem에서 찾을 수 없습니다.`);
    }
    throw new Error(`PubChem API 오류 (${response.status})`);
  }

  const json = await response.json() as PubChemRecord;
  const compound = json.PC_Compounds?.[0];
  if (!compound) throw new Error('PubChem 응답을 파싱할 수 없습니다.');

  // aid(원자 ID) → 배열 인덱스 맵
  const aidToIndex = new Map<number, number>();
  compound.atoms.aid.forEach((aid, i) => aidToIndex.set(aid, i));

  // 2D 좌표 추출
  const coordInfo = compound.coords?.[0];
  const conformer = coordInfo?.conformers?.[0];
  const coordAids = coordInfo?.aid ?? compound.atoms.aid;
  const xArr = conformer?.x ?? [];
  const yArr = conformer?.y ?? [];

  // aid → 좌표 맵
  const coordMap = new Map<number, { x: number; y: number }>();
  coordAids.forEach((aid, i) => {
    coordMap.set(aid, { x: xArr[i] ?? 0, y: yArr[i] ?? 0 });
  });

  // 원시 원자 목록
  const rawAtoms = compound.atoms.aid.map((aid, i) => {
    const coord = coordMap.get(aid) ?? { x: 0, y: 0 };
    return {
      symbol: ATOMIC_NUM_TO_SYMBOL[compound.atoms.element[i]] ?? 'X',
      rawX: coord.x,
      rawY: coord.y,
    };
  });

  // 좌표 정규화 (MoleculeViewer 기준: 200,180 중심, ±160 범위)
  const xs = rawAtoms.map(a => a.rawX);
  const ys = rawAtoms.map(a => a.rawY);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleFactor = 160 / Math.max(rangeX, rangeY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const atoms = rawAtoms.map(a => ({
    symbol: a.symbol,
    x: 200 + (a.rawX - cx) * scaleFactor,
    y: 180 + (a.rawY - cy) * scaleFactor,
  }));

  // 결합 추출
  const bondOrderMap: Record<number, Bond['type']> = {
    1: 'single', 2: 'double', 3: 'triple',
  };
  const bonds: Bond[] = [];
  if (compound.bonds) {
    for (let i = 0; i < compound.bonds.aid1.length; i++) {
      const from = aidToIndex.get(compound.bonds.aid1[i]);
      const to = aidToIndex.get(compound.bonds.aid2[i]);
      if (from === undefined || to === undefined) continue;
      bonds.push({
        from,
        to,
        type: bondOrderMap[compound.bonds.order[i]] ?? 'single',
      });
    }
  }

  // 고립 원자 처리 (예: CaCO3의 Ca²⁺ — 이온결합이라 PubChem 2D에 결합선 없음)
  // 결합에 포함된 원자 인덱스 수집
  const bondedSet = new Set<number>();
  bonds.forEach(b => { bondedSet.add(b.from); bondedSet.add(b.to); });

  // 결합이 전혀 없는 원자(고립 원자)를 찾아 가장 가까운 원자와 이온결합으로 연결
  if (bondedSet.size > 0) {
    atoms.forEach((atom, idx) => {
      if (bondedSet.has(idx)) return;
      // 가장 가까운 원자 찾기
      let minDist = Infinity;
      let nearestIdx = -1;
      atoms.forEach((other, otherIdx) => {
        if (otherIdx === idx) return;
        const dx = atom.x - other.x;
        const dy = atom.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; nearestIdx = otherIdx; }
      });
      if (nearestIdx >= 0) {
        bonds.push({ from: idx, to: nearestIdx, type: 'ionic' });
      }
    });
  }

  // 분자 이름/속성 추출
  let moleculeName = formula;
  let molecularFormula = formula;

  compound.props?.forEach(prop => {
    const label = prop.urn.label;
    const name = prop.urn.name;
    if (label === 'IUPAC Name' && name === 'Preferred' && prop.value.sval) {
      moleculeName = prop.value.sval;
    }
    if (label === 'Molecular Formula' && prop.value.sval) {
      molecularFormula = prop.value.sval;
    }
  });

  const result: MoleculeData = {
    formula: molecularFormula,
    name: moleculeName,
    atoms,
    bonds,
  };

  cache.set(formula, result);
  return result;
}
