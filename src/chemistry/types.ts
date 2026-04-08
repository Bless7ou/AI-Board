export type SimulationType =
  | 'molecule'
  | 'reaction'
  | 'ionic_bond'
  | 'covalent_bond'
  | 'electron_config'
  | 'acid_base'
  | 'redox'
  | 'unknown';

export interface Atom {
  symbol: string;
  name: string;
  atomicNumber: number;
  color: string;
  radius: number;
  electronegativity: number;
  valenceElectrons: number;
}

export interface Bond {
  from: number; // atom index
  to: number;   // atom index
  type: 'single' | 'double' | 'triple' | 'ionic';
}

export interface MoleculeData {
  formula: string;
  name: string;
  atoms: Array<{ symbol: string; x: number; y: number }>;
  bonds: Bond[];
  shape?: string;
  polarity?: 'polar' | 'nonpolar';
}

export interface ReactionData {
  equation: string;
  reactants: MoleculeData[];
  products: MoleculeData[];
  type: 'synthesis' | 'decomposition' | 'single_displacement' | 'double_displacement' | 'combustion' | 'neutralization' | 'redox';
  description: string;
}

export interface ParseResult {
  type: SimulationType;
  raw: string;
  formula?: string;      // DB에 없는 화학식을 PubChem에 조회할 때 사용
  molecule?: MoleculeData;
  reaction?: ReactionData;
  element?: string;
  keyword?: string;
  description: string;
}
