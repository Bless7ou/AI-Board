import type { ParseResult, ReactionData } from './types';
import { REACTION_KEYWORDS } from './moleculeData';
import { resolveIonicPair } from './ionicData';
import { ATOMS } from './atomData';

// 화학식 정규화: 유니코드 숫자 → 일반 숫자, 공백 제거
function normalize(text: string): string {
  return text
    .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2')
    .replace(/₃/g, '3').replace(/₄/g, '4').replace(/₅/g, '5')
    .replace(/₆/g, '6').replace(/₇/g, '7').replace(/₈/g, '8').replace(/₉/g, '9')
    .replace(/\s+/g, ' ')
    .trim();
}

// 텍스트에서 화학식 추출 (대문자로 시작하는 원소기호 패턴)
const FORMULA_PATTERN = /\b([A-Z][a-z]?\d*)+\b/g;

// 알려진 화학식 목록 (OCR 오인식 보정용)
const FORMULA_ALIASES: Record<string, string> = {
  'H20': 'H2O', 'H2o': 'H2O', 'h2o': 'H2O', 'h20': 'H2O',
  'C02': 'CO2', 'co2': 'CO2', 'Co2': 'CO2', 'cO2': 'CO2',
  'NH4': 'NH3', 'nh3': 'NH3', 'Nh3': 'NH3',
  'nacl': 'NaCl', 'NACL': 'NaCl', 'Nacl': 'NaCl', 'naCl': 'NaCl',
  'n2': 'N2', 'o2': 'O2', 'h2': 'H2', 'f2': 'F2', 'cl2': 'Cl2', 'br2': 'Br2', 'i2': 'I2',
  'HCI': 'HCl', 'Hcl': 'HCl', 'hcl': 'HCl', 'HcI': 'HCl',
  'naoh': 'NaOH', 'NAOH': 'NaOH', 'Naoh': 'NaOH', 'NaOh': 'NaOH',
  'koh': 'KOH', 'Koh': 'KOH',
  'h2so4': 'H2SO4', 'H2so4': 'H2SO4', 'H2S04': 'H2SO4',
  'caco3': 'CaCO3', 'CaC03': 'CaCO3',
  'fe2o3': 'Fe2O3', 'Fe203': 'Fe2O3', 'fe203': 'Fe2O3',
  'ch4': 'CH4', 'Ch4': 'CH4',
  'mgo': 'MgO', 'MGO': 'MgO', 'Mgo': 'MgO',
  'cao': 'CaO', 'CAO': 'CaO', 'Cao': 'CaO',
  'cuo': 'CuO', 'CUO': 'CuO', 'Cuo': 'CuO',
  'agcl': 'AgCl', 'AGCL': 'AgCl', 'Agcl': 'AgCl',
  'kcl': 'KCl', 'KCI': 'KCl', 'Kcl': 'KCl',
};

// 모든 원소 기호 (2글자 → 1글자 순서로 매칭)
const ELEMENT_SYMBOLS = [
  'He','Li','Be','Ne','Na','Mg','Al','Si','Cl','Ar','Ca','Sc','Ti','Cr','Mn',
  'Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Ag','Sn',
  'Xe','Ba','Pt','Au','Hg','Pb',
  'H','B','C','N','O','F','P','S','K','V','I','W',
];

// 대소문자 무시하고 원소 기호를 올바른 형태로 보정
function fixElementCase(text: string): string {
  let result = text;
  for (const sym of ELEMENT_SYMBOLS) {
    // 대소문자 무시 매칭 → 올바른 대소문자로 교체
    // 원소기호 뒤에 숫자/대문자/괄호/끝이 오는 패턴
    const pattern = new RegExp(
      sym.length === 2
        ? `(?<![A-Za-z])${sym[0]}${sym[1]}(?=[0-9A-Z()+\\-→>\\s]|$)`
        : `(?<![A-Za-z])${sym[0]}(?=[0-9A-Z()+\\-→>\\s]|$)`,
      'gi'
    );
    result = result.replace(pattern, sym);
  }
  return result;
}

function fixOCRErrors(text: string): string {
  let result = text;
  // 0 → O, l → 1 등 OCR 흔한 오류
  result = result.replace(/H20\b/g, 'H2O');
  result = result.replace(/C02\b/g, 'CO2');
  result = result.replace(/\b0([A-Z])/g, 'O$1'); // 0Na → ONa
  // 별칭 매칭
  for (const [wrong, right] of Object.entries(FORMULA_ALIASES)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
  }
  // 원소 기호 대소문자 보정
  result = fixElementCase(result);
  return result;
}

// 전하 표시 헬퍼
function chargeLabel(charge: number): string {
  if (charge === 0) return '';
  const abs = Math.abs(charge);
  const sign = charge > 0 ? '+' : '-';
  return abs === 1 ? sign : `${abs}${sign}`;
}

// 반응식 패턴: A + B → C + D  또는  A + B -> C + D
const REACTION_PATTERN = /(.+?)\s*(?:→|->|>)\s*(.+)/;

// ── 화살표 없는 반응물 조합 → 반응 유추 시스템 ──────────────────────────────

/** 계수 제거: "2HCl" → "HCl" */
function stripCoeff(s: string): string {
  return s.replace(/^\d+/, '');
}

const ACID_SET = new Set([
  'HCl','H2SO4','HNO3','CH3COOH','H3PO4','HF','HBr','HI','H2CO3','HClO4','HClO3','H2S',
]);
const BASE_SET = new Set([
  'NaOH','KOH','Ca(OH)2','Mg(OH)2','Ba(OH)2','LiOH','NH3','Al(OH)3','Fe(OH)3','Cu(OH)2','Fe(OH)2',
]);
const ACTIVE_METALS = new Set(['Li','K','Na','Ca','Mg','Al','Zn','Fe','Ni','Sn','Pb']);

/** 구체적 반응 테이블: key = 정렬된 반응물 (계수 제거) */
const INFER_TABLE: Record<string, { equation: string; type: ReactionData['type']; description: string }> = {
  // ── 중화 반응 ──
  'HCl+NaOH':       { equation: 'HCl + NaOH → NaCl + H₂O',               type: 'neutralization', description: '중화 반응' },
  'H2SO4+NaOH':     { equation: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',       type: 'neutralization', description: '중화 반응' },
  'HNO3+NaOH':      { equation: 'HNO₃ + NaOH → NaNO₃ + H₂O',            type: 'neutralization', description: '중화 반응' },
  'HCl+KOH':        { equation: 'HCl + KOH → KCl + H₂O',                 type: 'neutralization', description: '중화 반응' },
  'H2SO4+KOH':      { equation: 'H₂SO₄ + 2KOH → K₂SO₄ + 2H₂O',         type: 'neutralization', description: '중화 반응' },
  'HNO3+KOH':       { equation: 'HNO₃ + KOH → KNO₃ + H₂O',              type: 'neutralization', description: '중화 반응' },
  'Ca(OH)2+HCl':    { equation: 'Ca(OH)₂ + 2HCl → CaCl₂ + 2H₂O',        type: 'neutralization', description: '중화 반응' },
  'CH3COOH+NaOH':   { equation: 'CH₃COOH + NaOH → CH₃COONa + H₂O',      type: 'neutralization', description: '중화 반응' },
  'Ca(OH)2+H2SO4':  { equation: 'H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2H₂O',      type: 'neutralization', description: '중화 반응' },
  'HCl+Mg(OH)2':    { equation: '2HCl + Mg(OH)₂ → MgCl₂ + 2H₂O',        type: 'neutralization', description: '중화 반응' },
  'H3PO4+NaOH':     { equation: 'H₃PO₄ + 3NaOH → Na₃PO₄ + 3H₂O',       type: 'neutralization', description: '중화 반응' },
  'Ba(OH)2+HCl':    { equation: 'Ba(OH)₂ + 2HCl → BaCl₂ + 2H₂O',        type: 'neutralization', description: '중화 반응' },
  'HCl+LiOH':       { equation: 'HCl + LiOH → LiCl + H₂O',              type: 'neutralization', description: '중화 반응' },
  'HCl+NH3':        { equation: 'HCl + NH₃ → NH₄Cl',                     type: 'neutralization', description: '중화 반응' },
  'Ba(OH)2+H2SO4':  { equation: 'Ba(OH)₂ + H₂SO₄ → BaSO₄↓ + 2H₂O',     type: 'neutralization', description: '중화 반응 (앙금 동반)' },
  'CH3COOH+KOH':    { equation: 'CH₃COOH + KOH → CH₃COOK + H₂O',        type: 'neutralization', description: '중화 반응' },
  'H2SO4+Mg(OH)2':  { equation: 'H₂SO₄ + Mg(OH)₂ → MgSO₄ + 2H₂O',      type: 'neutralization', description: '중화 반응' },

  // ── 앙금 생성 (이중치환) ──
  'AgNO3+NaCl':     { equation: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃',          type: 'double_displacement', description: '앙금 생성 반응' },
  'AgNO3+KCl':      { equation: 'AgNO₃ + KCl → AgCl↓ + KNO₃',            type: 'double_displacement', description: '앙금 생성 반응' },
  'AgNO3+HCl':      { equation: 'AgNO₃ + HCl → AgCl↓ + HNO₃',            type: 'double_displacement', description: '앙금 생성 반응' },
  'BaCl2+Na2SO4':   { equation: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',      type: 'double_displacement', description: '앙금 생성 반응' },
  'BaCl2+H2SO4':    { equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',        type: 'double_displacement', description: '앙금 생성 반응' },
  'BaCl2+K2SO4':    { equation: 'BaCl₂ + K₂SO₄ → BaSO₄↓ + 2KCl',        type: 'double_displacement', description: '앙금 생성 반응' },
  'CaCl2+Na2CO3':   { equation: 'CaCl₂ + Na₂CO₃ → CaCO₃↓ + 2NaCl',      type: 'double_displacement', description: '앙금 생성 반응' },
  'KI+Pb(NO3)2':    { equation: 'Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃',       type: 'double_displacement', description: '앙금 생성 반응' },
  'NaI+Pb(NO3)2':   { equation: 'Pb(NO₃)₂ + 2NaI → PbI₂↓ + 2NaNO₃',     type: 'double_displacement', description: '앙금 생성 반응' },
  'HCl+Pb(NO3)2':   { equation: 'Pb(NO₃)₂ + 2HCl → PbCl₂↓ + 2HNO₃',     type: 'double_displacement', description: '앙금 생성 반응' },
  'AgNO3+Na2SO4':   { equation: '2AgNO₃ + Na₂SO₄ → Ag₂SO₄↓ + 2NaNO₃',   type: 'double_displacement', description: '앙금 생성 반응' },
  'AgNO3+K2CrO4':   { equation: '2AgNO₃ + K₂CrO₄ → Ag₂CrO₄↓ + 2KNO₃',  type: 'double_displacement', description: '앙금 생성 반응' },

  // ── 탄산염 + 산 (기체 발생) ──
  'CaCO3+HCl':      { equation: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑',    type: 'double_displacement', description: '탄산염과 산의 반응' },
  'HCl+Na2CO3':     { equation: 'Na₂CO₃ + 2HCl → 2NaCl + H₂O + CO₂↑',   type: 'double_displacement', description: '탄산염과 산의 반응' },
  'HCl+NaHCO3':     { equation: 'NaHCO₃ + HCl → NaCl + H₂O + CO₂↑',     type: 'double_displacement', description: '탄산수소염과 산의 반응' },
  'HCl+MgCO3':      { equation: 'MgCO₃ + 2HCl → MgCl₂ + H₂O + CO₂↑',    type: 'double_displacement', description: '탄산염과 산의 반응' },
  'CaCO3+HNO3':     { equation: 'CaCO₃ + 2HNO₃ → Ca(NO₃)₂ + H₂O + CO₂↑', type: 'double_displacement', description: '탄산염과 산의 반응' },
  'CaCO3+H2SO4':    { equation: 'CaCO₃ + H₂SO₄ → CaSO₄ + H₂O + CO₂↑',   type: 'double_displacement', description: '탄산염과 산의 반응' },

  // ── 금속 + 산 (수소 발생) ──
  'Fe+HCl':         { equation: 'Fe + 2HCl → FeCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },
  'HCl+Zn':         { equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },
  'HCl+Mg':         { equation: 'Mg + 2HCl → MgCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },
  'Al+HCl':         { equation: '2Al + 6HCl → 2AlCl₃ + 3H₂↑',            type: 'redox', description: '금속과 산의 반응' },
  'H2SO4+Zn':       { equation: 'Zn + H₂SO₄ → ZnSO₄ + H₂↑',             type: 'redox', description: '금속과 산의 반응' },
  'Fe+H2SO4':       { equation: 'Fe + H₂SO₄ → FeSO₄ + H₂↑',              type: 'redox', description: '금속과 산의 반응' },
  'H2SO4+Mg':       { equation: 'Mg + H₂SO₄ → MgSO₄ + H₂↑',              type: 'redox', description: '금속과 산의 반응' },
  'Ca+HCl':         { equation: 'Ca + 2HCl → CaCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },
  'HCl+Na':         { equation: '2Na + 2HCl → 2NaCl + H₂↑',              type: 'redox', description: '금속과 산의 반응' },
  'Al+H2SO4':       { equation: '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑',      type: 'redox', description: '금속과 산의 반응' },
  'HNO3+Zn':        { equation: '4Zn + 10HNO₃ → 4Zn(NO₃)₂ + NH₄NO₃ + 3H₂O', type: 'redox', description: '금속과 산의 반응' },
  'Ni+HCl':         { equation: 'Ni + 2HCl → NiCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },
  'Sn+HCl':         { equation: 'Sn + 2HCl → SnCl₂ + H₂↑',               type: 'redox', description: '금속과 산의 반응' },

  // ── 금속 치환 (이온화 경향) ──
  'CuSO4+Zn':       { equation: 'Zn + CuSO₄ → ZnSO₄ + Cu',              type: 'redox', description: '금속의 이온화 경향 반응' },
  'CuSO4+Fe':       { equation: 'Fe + CuSO₄ → FeSO₄ + Cu',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'CuSO4+Mg':       { equation: 'Mg + CuSO₄ → MgSO₄ + Cu',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'AgNO3+Cu':       { equation: 'Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',          type: 'redox', description: '금속의 이온화 경향 반응' },
  'AgNO3+Zn':       { equation: 'Zn + 2AgNO₃ → Zn(NO₃)₂ + 2Ag',          type: 'redox', description: '금속의 이온화 경향 반응' },
  'AgNO3+Fe':       { equation: 'Fe + 2AgNO₃ → Fe(NO₃)₂ + 2Ag',           type: 'redox', description: '금속의 이온화 경향 반응' },
  'FeSO4+Zn':       { equation: 'Zn + FeSO₄ → ZnSO₄ + Fe',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'FeCl2+Mg':       { equation: 'Mg + FeCl₂ → MgCl₂ + Fe',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'ZnSO4+Mg':       { equation: 'Mg + ZnSO₄ → MgSO₄ + Zn',              type: 'redox', description: '금속의 이온화 경향 반응' },
  'CuCl2+Fe':       { equation: 'Fe + CuCl₂ → FeCl₂ + Cu',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'CuCl2+Zn':       { equation: 'Zn + CuCl₂ → ZnCl₂ + Cu',               type: 'redox', description: '금속의 이온화 경향 반응' },
  'AgNO3+Mg':       { equation: 'Mg + 2AgNO₃ → Mg(NO₃)₂ + 2Ag',          type: 'redox', description: '금속의 이온화 경향 반응' },
  'CuSO4+Al':       { equation: '2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu',        type: 'redox', description: '금속의 이온화 경향 반응' },

  // ── 합성 반응 ──
  'Cl2+Na':         { equation: '2Na + Cl₂ → 2NaCl',                      type: 'synthesis', description: '합성 반응' },
  'H2+O2':          { equation: '2H₂ + O₂ → 2H₂O',                       type: 'synthesis', description: '합성 반응' },
  'Fe+S':           { equation: 'Fe + S → FeS',                           type: 'synthesis', description: '합성 반응' },
  'Mg+O2':          { equation: '2Mg + O₂ → 2MgO',                        type: 'synthesis', description: '합성 반응' },
  'H2+N2':          { equation: 'N₂ + 3H₂ → 2NH₃',                        type: 'synthesis', description: '합성 반응 (하버법)' },
  'Fe+O2':          { equation: '4Fe + 3O₂ → 2Fe₂O₃',                     type: 'synthesis', description: '합성 반응' },
  'Ca+O2':          { equation: '2Ca + O₂ → 2CaO',                        type: 'synthesis', description: '합성 반응' },
  'Na+O2':          { equation: '4Na + O₂ → 2Na₂O',                       type: 'synthesis', description: '합성 반응' },
  'Cl2+K':          { equation: '2K + Cl₂ → 2KCl',                        type: 'synthesis', description: '합성 반응' },
  'Al+O2':          { equation: '4Al + 3O₂ → 2Al₂O₃',                     type: 'synthesis', description: '합성 반응' },
  'Cu+O2':          { equation: '2Cu + O₂ → 2CuO',                        type: 'synthesis', description: '합성 반응' },
  'N2+O2':          { equation: 'N₂ + O₂ → 2NO',                          type: 'synthesis', description: '합성 반응' },
  'Cl2+H2':         { equation: 'H₂ + Cl₂ → 2HCl',                        type: 'synthesis', description: '합성 반응' },
  'Cu+S':           { equation: 'Cu + S → CuS',                           type: 'synthesis', description: '합성 반응' },
  'Zn+S':           { equation: 'Zn + S → ZnS',                           type: 'synthesis', description: '합성 반응' },
  'Cl2+Fe':         { equation: '2Fe + 3Cl₂ → 2FeCl₃',                    type: 'synthesis', description: '합성 반응' },
  'Br2+H2':         { equation: 'H₂ + Br₂ → 2HBr',                        type: 'synthesis', description: '합성 반응' },

  // ── 연소 반응 ──
  'C+O2':           { equation: 'C + O₂ → CO₂',                           type: 'combustion', description: '연소 반응' },
  'S+O2':           { equation: 'S + O₂ → SO₂',                           type: 'combustion', description: '연소 반응' },
  'CH4+O2':         { equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',               type: 'combustion', description: '연소 반응' },
  'C2H6+O2':        { equation: '2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O',            type: 'combustion', description: '연소 반응' },
  'C3H8+O2':        { equation: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',             type: 'combustion', description: '연소 반응' },
  'C2H5OH+O2':      { equation: 'C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O',           type: 'combustion', description: '연소 반응' },
  'CH3OH+O2':       { equation: '2CH₃OH + 3O₂ → 2CO₂ + 4H₂O',            type: 'combustion', description: '연소 반응' },
  'C2H4+O2':        { equation: 'C₂H₄ + 3O₂ → 2CO₂ + 2H₂O',             type: 'combustion', description: '연소 반응' },
  'C2H2+O2':        { equation: '2C₂H₂ + 5O₂ → 4CO₂ + 2H₂O',            type: 'combustion', description: '연소 반응' },

  // ── 금속 + 물 ──
  'H2O+Na':         { equation: '2Na + 2H₂O → 2NaOH + H₂↑',             type: 'redox', description: '알칼리 금속과 물의 반응' },
  'H2O+K':          { equation: '2K + 2H₂O → 2KOH + H₂↑',               type: 'redox', description: '알칼리 금속과 물의 반응' },
  'Ca+H2O':         { equation: 'Ca + 2H₂O → Ca(OH)₂ + H₂↑',             type: 'redox', description: '알칼리 토금속과 물의 반응' },
  'H2O+Li':         { equation: '2Li + 2H₂O → 2LiOH + H₂↑',             type: 'redox', description: '알칼리 금속과 물의 반응' },

  // ── 산화물 + 물 ──
  'CaO+H2O':        { equation: 'CaO + H₂O → Ca(OH)₂',                   type: 'synthesis', description: '염기성 산화물과 물의 반응' },
  'H2O+Na2O':       { equation: 'Na₂O + H₂O → 2NaOH',                    type: 'synthesis', description: '염기성 산화물과 물의 반응' },
  'H2O+SO3':        { equation: 'SO₃ + H₂O → H₂SO₄',                     type: 'synthesis', description: '산성 산화물과 물의 반응' },
  'CO2+H2O':        { equation: 'CO₂ + H₂O → H₂CO₃',                     type: 'synthesis', description: '산성 산화물과 물의 반응' },
  'H2O+SO2':        { equation: 'SO₂ + H₂O → H₂SO₃',                     type: 'synthesis', description: '산성 산화물과 물의 반응' },
  'H2O+P2O5':       { equation: 'P₂O₅ + 3H₂O → 2H₃PO₄',                 type: 'synthesis', description: '산성 산화물과 물의 반응' },
  'H2O+K2O':        { equation: 'K₂O + H₂O → 2KOH',                      type: 'synthesis', description: '염기성 산화물과 물의 반응' },
  'H2O+MgO':        { equation: 'MgO + H₂O → Mg(OH)₂',                   type: 'synthesis', description: '염기성 산화물과 물의 반응' },

  // ── 산화물 + 산/염기 ──
  'CaO+HCl':        { equation: 'CaO + 2HCl → CaCl₂ + H₂O',             type: 'neutralization', description: '염기성 산화물과 산의 반응' },
  'HCl+MgO':        { equation: 'MgO + 2HCl → MgCl₂ + H₂O',              type: 'neutralization', description: '염기성 산화물과 산의 반응' },
  'CuO+HCl':        { equation: 'CuO + 2HCl → CuCl₂ + H₂O',             type: 'neutralization', description: '염기성 산화물과 산의 반응' },
  'Fe2O3+HCl':      { equation: 'Fe₂O₃ + 6HCl → 2FeCl₃ + 3H₂O',         type: 'neutralization', description: '염기성 산화물과 산의 반응' },
  'CaO+CO2':        { equation: 'CaO + CO₂ → CaCO₃',                     type: 'synthesis', description: '산화물 결합 반응' },
  'CO2+NaOH':       { equation: '2NaOH + CO₂ → Na₂CO₃ + H₂O',           type: 'neutralization', description: '염기와 산성 산화물의 반응' },
  'CO2+Ca(OH)2':    { equation: 'Ca(OH)₂ + CO₂ → CaCO₃↓ + H₂O',         type: 'double_displacement', description: '석회수와 이산화탄소 반응' },
  'CO2+KOH':        { equation: '2KOH + CO₂ → K₂CO₃ + H₂O',             type: 'neutralization', description: '염기와 산성 산화물의 반응' },
};

/** 화살표 없는 반응물 조합으로 반응을 유추한다 */
function inferReaction(text: string, rawText: string): ParseResult | null {
  // 화살표가 있으면 기존 parseReaction에서 처리
  if (/[→>]|->/.test(text)) return null;

  // A + B 패턴 감지
  const parts = text.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const formulas = parts.map(stripCoeff);
  const key = [...formulas].sort().join('+');

  // 1) 구체적 테이블 매칭
  const known = INFER_TABLE[key];
  if (known) {
    return {
      type: 'reaction',
      raw: rawText,
      reaction: { equation: known.equation, reactants: [], products: [], type: known.type, description: known.description },
      description: `${known.description}: ${known.equation}`,
    };
  }

  // 2) 일반 규칙 기반 분류 (테이블에 없는 조합)
  const hasAcid  = formulas.some(f => ACID_SET.has(f));
  const hasBase  = formulas.some(f => BASE_SET.has(f));
  const hasMetal = formulas.some(f => ACTIVE_METALS.has(f));
  const hasO2    = formulas.includes('O2');
  const hasH2O   = formulas.includes('H2O');

  // 산 + 염기 → 중화
  if (hasAcid && hasBase) {
    const acid = formulas.find(f => ACID_SET.has(f))!;
    const base = formulas.find(f => BASE_SET.has(f))!;
    return {
      type: 'reaction', raw: rawText,
      reaction: { equation: `${acid} + ${base} → 중화 반응`, reactants: [], products: [], type: 'neutralization', description: '중화 반응' },
      description: `중화 반응: ${acid} + ${base}`,
    };
  }

  // 금속 + 산 → 수소 발생
  if (hasMetal && hasAcid) {
    const metal = formulas.find(f => ACTIVE_METALS.has(f))!;
    const acid  = formulas.find(f => ACID_SET.has(f))!;
    return {
      type: 'reaction', raw: rawText,
      reaction: { equation: `${metal} + ${acid} → 수소 발생`, reactants: [], products: [], type: 'redox', description: '금속과 산의 반응' },
      description: `금속과 산의 반응: ${metal} + ${acid}`,
    };
  }

  // 물질 + O₂ → 연소/산화
  if (hasO2) {
    const other = formulas.find(f => f !== 'O2')!;
    return {
      type: 'reaction', raw: rawText,
      reaction: { equation: `${other} + O₂ → 산화`, reactants: [], products: [], type: 'combustion', description: '연소/산화 반응' },
      description: `연소/산화 반응: ${other} + O₂`,
    };
  }

  // 금속 + 물 → 반응
  if (hasMetal && hasH2O) {
    const metal = formulas.find(f => ACTIVE_METALS.has(f))!;
    return {
      type: 'reaction', raw: rawText,
      reaction: { equation: `${metal} + H₂O → 반응`, reactants: [], products: [], type: 'redox', description: '금속과 물의 반응' },
      description: `금속과 물의 반응: ${metal} + H₂O`,
    };
  }

  // 두 원소 → 합성
  if (formulas.every(f => ELEMENT_SYMBOLS.includes(f) || /^[A-Z][a-z]?\d*$/.test(f))) {
    return {
      type: 'reaction', raw: rawText,
      reaction: { equation: `${formulas.join(' + ')} → 합성`, reactants: [], products: [], type: 'synthesis', description: '합성 반응' },
      description: `합성 반응: ${formulas.join(' + ')}`,
    };
  }

  return null;
}

export function parseChemistry(rawText: string): ParseResult {
  const text = fixOCRErrors(normalize(rawText));

  // 1. 반응식 우선 감지
  const reactionMatch = text.match(REACTION_PATTERN);
  if (reactionMatch) {
    return parseReaction(text, reactionMatch[1], reactionMatch[2]);
  }

  // 1.5. 화살표 없는 반응물 조합으로 반응 유추
  const inferred = inferReaction(text, rawText);
  if (inferred) return inferred;

  // 2. 한국어 키워드 감지
  for (const [keyword, target] of Object.entries(REACTION_KEYWORDS)) {
    if (text.includes(keyword)) {
      return parseKeyword(text, keyword, target);
    }
  }

  // 3. 원소 단독 감지 (전자배치) — 대소문자 유연 처리
  const singleElement = text.match(/^([A-Za-z]{1,2})$/);
  if (singleElement) {
    const input = singleElement[1];
    // 정확히 매칭되는 원소 기호 찾기
    const matched = ELEMENT_SYMBOLS.find(s => s.toLowerCase() === input.toLowerCase());
    if (matched) {
      return {
        type: 'electron_config',
        raw: rawText,
        element: matched,
        description: `${matched} 원소의 전자 배치`,
      };
    }
  }

  // 4. 이온결합 화합물 감지 (금속+비금속 조합)
  const ionicPair = resolveIonicPair(text);
  if (ionicPair) {
    return {
      type: 'ionic_bond',
      raw: rawText,
      formula: text,
      ionicPair,
      description: `${text} 이온결합: ${ionicPair.cation}${chargeLabel(ionicPair.cationCharge)} + ${ionicPair.anion}${chargeLabel(ionicPair.anionCharge)}`,
    };
  }

  // 5. 화학식 감지
  const formulaMatches = text.match(FORMULA_PATTERN);
  if (formulaMatches) {
    const formula = formulaMatches[0];

    // 5-a. 내장 원소이면 전자배치 시뮬레이션 우선
    if (ATOMS[formula]) {
      return {
        type: 'electron_config',
        raw: rawText,
        element: formula,
        description: `${formula} 원소의 전자 배치`,
      };
    }

    // 5-b. 내장 이온결합 화합물이면 이온결합 시뮬레이션 우선
    const ionicFallback = resolveIonicPair(formula);
    if (ionicFallback) {
      return {
        type: 'ionic_bond',
        raw: rawText,
        formula,
        ionicPair: ionicFallback,
        description: `${formula} 이온결합: ${ionicFallback.cation}${chargeLabel(ionicFallback.cationCharge)} + ${ionicFallback.anion}${chargeLabel(ionicFallback.anionCharge)}`,
      };
    }

    // 5-c. 그 외 → PubChem 조회
    return {
      type: 'molecule',
      raw: rawText,
      formula,
      description: `${formula} — PubChem에서 검색 중`,
    };
  }

  // 5. 인식 실패
  return {
    type: 'unknown',
    raw: rawText,
    description: '인식된 화학 내용이 없습니다. 화학식이나 반응식을 써주세요.',
  };
}

function parseReaction(text: string, reactantStr: string, productStr: string): ParseResult {
  const equation = text;

  // ① 연소 반응: O₂ 포함 + 생성물에 CO₂ 또는 H₂O
  if ((text.includes('O2') || text.includes('O₂')) &&
      (text.includes('CO2') || text.includes('CO₂') || text.includes('H2O') || text.includes('H₂O'))) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'combustion', description: '연소 반응' },
      description: '연소 반응 애니메이션',
    };
  }

  // ② 중화 반응: 산 + 염기
  const isAcid = text.includes('HCl') || text.includes('H2SO4') || text.includes('HNO3') ||
                 text.includes('H₂SO₄') || text.includes('HNO₃') || text.includes('CH3COOH');
  const isBase = text.includes('NaOH') || text.includes('KOH') || text.includes('Ca(OH)') ||
                 text.includes('NH3') || text.includes('NH₃');
  if (isAcid && isBase) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'neutralization', description: '산염기 중화 반응' },
      description: '중화 반응: H⁺ + OH⁻ → H₂O',
    };
  }

// ③ 산화환원 반응: 금속 + 이온 포함
  const redoxMetals = ['Zn', 'Fe', 'Cu', 'Mg', 'Al', 'Na', 'K'];
  const hasRedoxMetal = redoxMetals.some(m => text.includes(m));
  const hasIon = text.includes('SO4') || text.includes('NO3') || text.includes('Cl2') ||
                 text.includes('Cl₂') || text.includes('F2') || text.includes('Br2');
  if (hasRedoxMetal && hasIon) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'redox', description: '산화환원 반응' },
      description: '산화환원 반응: 전자 이동',
    };
  }

  // ④ 이중치환(앙금 생성): 생성물에 ↓ 포함 또는 난용성 염
  const precipitates = ['AgCl', 'BaSO4', 'PbSO4', 'CaCO3', 'BaCO3', 'PbCl'];
  const hasPrecipitate = precipitates.some(p => text.includes(p)) || text.includes('↓');
  if (hasPrecipitate) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'double_displacement', description: '이중치환(앙금 생성) 반응' },
      description: '이중치환 반응: 앙금 생성',
    };
  }

  // ⑤ 분해 반응: 반응물 1개, 생성물 2개 이상
  const reactantParts = reactantStr.split('+').map(s => s.trim()).filter(Boolean);
  const productParts = productStr.split('+').map(s => s.trim()).filter(Boolean);
  if (reactantParts.length === 1 && productParts.length >= 2) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'decomposition', description: '분해 반응' },
      description: '분해 반응: 한 물질이 두 가지 이상으로 분해',
    };
  }

  // ⑥ 합성 반응: 반응물 2개 이상, 생성물 1개
  if (reactantParts.length >= 2 && productParts.length === 1) {
    return {
      type: 'reaction',
      raw: text,
      reaction: { equation, reactants: [], products: [], type: 'synthesis', description: '합성 반응' },
      description: '합성 반응: 두 물질이 결합하여 하나로',
    };
  }

  // ⑦ 기본 반응식
  return {
    type: 'reaction',
    raw: text,
    reaction: { equation, reactants: [], products: [], type: 'synthesis', description: '화학 반응' },
    description: `반응식: ${equation}`,
  };
}

function parseKeyword(text: string, keyword: string, target: string): ParseResult {
  if (target === 'sim:ionic_bond') {
    return { type: 'ionic_bond', raw: text, keyword, description: '이온결합 형성 과정 (Na → Na⁺ + e⁻, Cl + e⁻ → Cl⁻)' };
  }
  if (target === 'sim:covalent_bond') {
    return { type: 'covalent_bond', raw: text, keyword, description: '공유결합 형성 과정 (전자쌍 공유)' };
  }
  if (target === 'sim:redox') {
    return { type: 'redox', raw: text, keyword, description: '산화환원 반응: 전자 이동 과정' };
  }
  if (target === 'sim:acid_base') {
    return { type: 'acid_base', raw: text, keyword, description: '산염기 중화 반응: H⁺ + OH⁻ → H₂O' };
  }
  if (target === 'sim:synthesis') {
    return {
      type: 'reaction', raw: text, keyword,
      reaction: { equation: 'N₂ + 3H₂ → 2NH₃', reactants: [], products: [], type: 'synthesis', description: '합성 반응' },
      description: '합성 반응: N₂ + 3H₂ → 2NH₃ (하버법)',
    };
  }
  if (target === 'sim:decomposition') {
    return {
      type: 'reaction', raw: text, keyword,
      reaction: { equation: '2H₂O → 2H₂ + O₂', reactants: [], products: [], type: 'decomposition', description: '분해 반응' },
      description: '분해 반응: 2H₂O → 2H₂ + O₂ (전기분해)',
    };
  }
  if (target === 'sim:double_displacement') {
    return {
      type: 'reaction', raw: text, keyword,
      reaction: { equation: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃', reactants: [], products: [], type: 'double_displacement', description: '이중치환 반응' },
      description: '이중치환 반응: AgNO₃ + NaCl → AgCl↓ + NaNO₃',
    };
  }
  if (target === 'sim:electron_config') {
    return { type: 'electron_config', raw: text, keyword, element: 'Na', description: '원소의 전자 배치' };
  }
  if (target === 'sim:combustion') {
    return {
      type: 'reaction', raw: text, keyword,
      reaction: { equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O', reactants: [], products: [], type: 'combustion', description: '연소 반응' },
      description: '연소 반응: CH₄ + 2O₂ → CO₂ + 2H₂O',
    };
  }
  
  // 나머지는 PubChem 화학식으로 조회
  return {
    type: 'molecule',
    raw: text,
    formula: target,
    keyword,
    description: `${keyword} 예시: ${target}`,
  };
}
