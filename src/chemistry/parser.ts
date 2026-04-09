import type { ParseResult } from './types';
import { REACTION_KEYWORDS } from './moleculeData';

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

  // 4. 화학식 감지 → 항상 PubChem으로 조회
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

function parseReaction(text: string, _reactantStr: string, _productStr: string): ParseResult {
  const equation = text;

  // 연소 반응
  if (text.includes('O2') || text.includes('O₂')) {
    if (text.includes('CO2') || text.includes('H2O')) {
      return {
        type: 'reaction',
        raw: text,
        reaction: {
          equation,
          reactants: [],
          products: [],
          type: 'combustion',
          description: '연소 반응',
        },
        description: '연소 반응 애니메이션',
      };
    }
  }

  // 중화 반응
  if ((text.includes('HCl') || text.includes('H2SO4') || text.includes('HNO3')) &&
      (text.includes('NaOH') || text.includes('KOH') || text.includes('Ca(OH)'))) {
    return {
      type: 'reaction',
      raw: text,
      reaction: {
        equation,
        reactants: [],
        products: [],
        type: 'neutralization',
        description: '산염기 중화 반응',
      },
      description: '중화 반응: H⁺ + OH⁻ → H₂O',
    };
  }

  // 기본 반응식
  return {
    type: 'reaction',
    raw: text,
    reaction: {
      equation,
      reactants: [],
      products: [],
      type: 'synthesis',
      description: '화학 반응',
    },
    description: `반응식: ${equation}`,
  };
}

function parseKeyword(text: string, keyword: string, target: string): ParseResult {
  // 전용 시뮬레이션 컴포넌트 사용 (sim:* 접두사)
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

  // 나머지는 PubChem 화학식으로 조회
  return {
    type: 'molecule',
    raw: text,
    formula: target,
    keyword,
    description: `${keyword} 예시: ${target}`,
  };
}
