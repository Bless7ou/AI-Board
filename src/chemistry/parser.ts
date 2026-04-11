import type { ParseResult } from './types';
import { REACTION_KEYWORDS } from './moleculeData';
import { resolveIonicPair } from './ionicData';

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
  'H20': 'H2O', 'H2o': 'H2O', 'h2o': 'H2O',
  'C02': 'CO2', 'co2': 'CO2',
  'NH4': 'NH3', 'nacl': 'NaCl', 'NACL': 'NaCl',
  'n2': 'N2', 'o2': 'O2', 'h2': 'H2',
  'HCI': 'HCl', 'Hcl': 'HCl',
};

function fixOCRErrors(text: string): string {
  let result = text;
  // 0 → O, l → 1 등 OCR 흔한 오류
  result = result.replace(/H20\b/g, 'H2O');
  result = result.replace(/C02\b/g, 'CO2');
  result = result.replace(/\b0([A-Z])/g, 'O$1'); // 0Na → ONa
  for (const [wrong, right] of Object.entries(FORMULA_ALIASES)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
  }
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

export function parseChemistry(rawText: string): ParseResult {
  const text = fixOCRErrors(normalize(rawText));

  // 1. 반응식 우선 감지
  const reactionMatch = text.match(REACTION_PATTERN);
  if (reactionMatch) {
    return parseReaction(text, reactionMatch[1], reactionMatch[2]);
  }

  // 2. 한국어 키워드 감지
  for (const [keyword, target] of Object.entries(REACTION_KEYWORDS)) {
    if (text.includes(keyword)) {
      return parseKeyword(text, keyword, target);
    }
  }

  // 3. 원소 단독 감지 (전자배치)
  const singleElement = text.match(/^([A-Z][a-z]?)$/);
  if (singleElement && singleElement[1].length <= 2) {
    return {
      type: 'electron_config',
      raw: rawText,
      element: singleElement[1],
      description: `${singleElement[1]} 원소의 전자 배치`,
    };
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

  // 5. 화학식 감지 → PubChem으로 조회
  const formulaMatches = text.match(FORMULA_PATTERN);
  if (formulaMatches) {
    const formula = formulaMatches[0];
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
