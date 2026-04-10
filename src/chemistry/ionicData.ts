import type { IonicPair } from './types';

/* ── 템플릿 DB (교과서 주요 이온결합 화합물) ── */
export const IONIC_DB: Record<string, IonicPair> = {
  // 1족 할로겐화물
  'LiF':   { cation: 'Li', anion: 'F',  cationCharge: 1, anionCharge: -1, transfer: 1 },
  'LiCl':  { cation: 'Li', anion: 'Cl', cationCharge: 1, anionCharge: -1, transfer: 1 },
  'NaF':   { cation: 'Na', anion: 'F',  cationCharge: 1, anionCharge: -1, transfer: 1 },
  'NaCl':  { cation: 'Na', anion: 'Cl', cationCharge: 1, anionCharge: -1, transfer: 1 },
  'NaBr':  { cation: 'Na', anion: 'Br', cationCharge: 1, anionCharge: -1, transfer: 1 },
  'NaI':   { cation: 'Na', anion: 'I',  cationCharge: 1, anionCharge: -1, transfer: 1 },
  'KF':    { cation: 'K',  anion: 'F',  cationCharge: 1, anionCharge: -1, transfer: 1 },
  'KCl':   { cation: 'K',  anion: 'Cl', cationCharge: 1, anionCharge: -1, transfer: 1 },
  'KBr':   { cation: 'K',  anion: 'Br', cationCharge: 1, anionCharge: -1, transfer: 1 },
  'KI':    { cation: 'K',  anion: 'I',  cationCharge: 1, anionCharge: -1, transfer: 1 },
  'AgCl':  { cation: 'Ag', anion: 'Cl', cationCharge: 1, anionCharge: -1, transfer: 1 },
  // 2족 산화물
  'MgO':   { cation: 'Mg', anion: 'O',  cationCharge: 2, anionCharge: -2, transfer: 2 },
  'CaO':   { cation: 'Ca', anion: 'O',  cationCharge: 2, anionCharge: -2, transfer: 2 },
  'ZnO':   { cation: 'Zn', anion: 'O',  cationCharge: 2, anionCharge: -2, transfer: 2 },
  'FeO':   { cation: 'Fe', anion: 'O',  cationCharge: 2, anionCharge: -2, transfer: 2 },
  // 2족 할로겐화물
  'MgCl2': { cation: 'Mg', anion: 'Cl', cationCharge: 2, anionCharge: -1, transfer: 2 },
  'MgF2':  { cation: 'Mg', anion: 'F',  cationCharge: 2, anionCharge: -1, transfer: 2 },
  'CaCl2': { cation: 'Ca', anion: 'Cl', cationCharge: 2, anionCharge: -1, transfer: 2 },
  'CaF2':  { cation: 'Ca', anion: 'F',  cationCharge: 2, anionCharge: -1, transfer: 2 },
  // 기타
  'Al2O3': { cation: 'Al', anion: 'O',  cationCharge: 3, anionCharge: -2, transfer: 3 },
  'Fe2O3': { cation: 'Fe', anion: 'O',  cationCharge: 3, anionCharge: -2, transfer: 3 },
  'CuO':   { cation: 'Cu', anion: 'O',  cationCharge: 2, anionCharge: -2, transfer: 2 },
};

/* ── 자동 파서: 금속 양이온 목록 ── */
const METAL_CHARGES: [string, number][] = [
  ['Al', 3], ['Fe', 2], ['Mg', 2], ['Ca', 2], ['Zn', 2], ['Cu', 2],
  ['Na', 1], ['Li', 1], ['K',  1], ['Ag', 1], ['Au', 1],
];

/* ── 자동 파서: 비금속 음이온 목록 (긴 기호 먼저) ── */
const ANION_CHARGES: [string, number][] = [
  ['Cl', -1], ['Br', -1], ['F', -1], ['I', -1],
  ['O',  -2], ['S',  -2], ['N', -3],
];

/** 화학식에서 이온 쌍 자동 추출 */
function parseIonicFormula(formula: string): IonicPair | null {
  for (const [metal, mCharge] of METAL_CHARGES) {
    if (!formula.startsWith(metal)) continue;
    // 금속 뒤 숫자 제거 후 나머지
    const rest = formula.slice(metal.length).replace(/^\d+/, '');
    for (const [anionSym, aCharge] of ANION_CHARGES) {
      if (rest.startsWith(anionSym)) {
        return {
          cation: metal, anion: anionSym,
          cationCharge: mCharge, anionCharge: aCharge,
          transfer: mCharge,     // 양이온이 내놓는 전자 수 = 양이온 전하
        };
      }
    }
  }
  return null;
}

/**
 * DB 먼저 확인 → 없으면 자동 파싱
 * 이온결합 화합물이 아니면 null 반환
 */
export function resolveIonicPair(formula: string): IonicPair | null {
  return IONIC_DB[formula] ?? parseIonicFormula(formula);
}
