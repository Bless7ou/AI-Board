import type { MoleculeData } from './types';

export const MOLECULES: Record<string, MoleculeData> = {
  'H2O': {
    formula: 'H₂O', name: '물',
    atoms: [
      { symbol: 'O', x: 200, y: 160 },
      { symbol: 'H', x: 130, y: 220 },
      { symbol: 'H', x: 270, y: 220 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'single' },
      { from: 0, to: 2, type: 'single' },
    ],
    shape: '굽은형 (104.5°)',
    polarity: 'polar',
  },
  'CO2': {
    formula: 'CO₂', name: '이산화탄소',
    atoms: [
      { symbol: 'O', x: 100, y: 180 },
      { symbol: 'C', x: 200, y: 180 },
      { symbol: 'O', x: 300, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'double' },
      { from: 1, to: 2, type: 'double' },
    ],
    shape: '직선형 (180°)',
    polarity: 'nonpolar',
  },
  'NH3': {
    formula: 'NH₃', name: '암모니아',
    atoms: [
      { symbol: 'N', x: 200, y: 140 },
      { symbol: 'H', x: 120, y: 220 },
      { symbol: 'H', x: 200, y: 240 },
      { symbol: 'H', x: 280, y: 220 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'single' },
      { from: 0, to: 2, type: 'single' },
      { from: 0, to: 3, type: 'single' },
    ],
    shape: '삼각뿔형 (107°)',
    polarity: 'polar',
  },
  'CH4': {
    formula: 'CH₄', name: '메테인',
    atoms: [
      { symbol: 'C', x: 200, y: 180 },
      { symbol: 'H', x: 200, y: 90  },
      { symbol: 'H', x: 290, y: 235 },
      { symbol: 'H', x: 110, y: 235 },
      { symbol: 'H', x: 200, y: 270 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'single' },
      { from: 0, to: 2, type: 'single' },
      { from: 0, to: 3, type: 'single' },
      { from: 0, to: 4, type: 'single' },
    ],
    shape: '정사면체형 (109.5°)',
    polarity: 'nonpolar',
  },
  'NaCl': {
    formula: 'NaCl', name: '염화나트륨',
    atoms: [
      { symbol: 'Na', x: 140, y: 180 },
      { symbol: 'Cl', x: 270, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'ionic' },
    ],
    shape: '이온결합',
    polarity: 'polar',
  },
  'N2': {
    formula: 'N₂', name: '질소',
    atoms: [
      { symbol: 'N', x: 150, y: 180 },
      { symbol: 'N', x: 260, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'triple' },
    ],
    shape: '직선형',
    polarity: 'nonpolar',
  },
  'O2': {
    formula: 'O₂', name: '산소',
    atoms: [
      { symbol: 'O', x: 150, y: 180 },
      { symbol: 'O', x: 260, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'double' },
    ],
    shape: '직선형',
    polarity: 'nonpolar',
  },
  'HCl': {
    formula: 'HCl', name: '염화수소',
    atoms: [
      { symbol: 'H', x: 150, y: 180 },
      { symbol: 'Cl', x: 270, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'single' },
    ],
    shape: '직선형',
    polarity: 'polar',
  },
  'H2': {
    formula: 'H₂', name: '수소',
    atoms: [
      { symbol: 'H', x: 160, y: 180 },
      { symbol: 'H', x: 250, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'single' },
    ],
    shape: '직선형',
    polarity: 'nonpolar',
  },
  'H2SO4': {
    formula: 'H₂SO₄', name: '황산',
    atoms: [
      { symbol: 'S',  x: 200, y: 180 },
      { symbol: 'O',  x: 200, y: 90  },
      { symbol: 'O',  x: 290, y: 180 },
      { symbol: 'O',  x: 200, y: 270 },
      { symbol: 'O',  x: 110, y: 180 },
      { symbol: 'H',  x: 350, y: 180 },
      { symbol: 'H',  x: 200, y: 330 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'double' },
      { from: 0, to: 2, type: 'single' },
      { from: 0, to: 3, type: 'single' },
      { from: 0, to: 4, type: 'double' },
      { from: 2, to: 5, type: 'single' },
      { from: 3, to: 6, type: 'single' },
    ],
    shape: '사면체형',
    polarity: 'polar',
  },
  'NaOH': {
    formula: 'NaOH', name: '수산화나트륨',
    atoms: [
      { symbol: 'Na', x: 130, y: 180 },
      { symbol: 'O',  x: 240, y: 180 },
      { symbol: 'H',  x: 320, y: 180 },
    ],
    bonds: [
      { from: 0, to: 1, type: 'ionic' },
      { from: 1, to: 2, type: 'single' },
    ],
    shape: '직선형',
    polarity: 'polar',
  },
};

export const REACTION_KEYWORDS: Record<string, string> = {
  '이온결합': 'NaCl',
  '공유결합': 'H2O',
  '극성': 'H2O',
  '무극성': 'CO2',
  '산화환원': 'redox',
  '산염기': 'acid_base',
  '중화': 'neutralization',
  '연소': 'combustion',
};
