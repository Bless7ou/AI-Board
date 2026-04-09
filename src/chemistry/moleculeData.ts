// 한국어 키워드 → 처리 방식 매핑
// 'sim:*' : 전용 시뮬레이션 컴포넌트 사용
// 그 외   : PubChem에서 조회할 화학식
export const REACTION_KEYWORDS: Record<string, string> = {
  '이온결합':   'sim:ionic_bond',
  '공유결합':   'sim:covalent_bond',
  '산화환원':   'sim:redox',
  '산화':       'sim:redox',
  '환원':       'sim:redox',
  '산염기':     'sim:acid_base',
  '중화':       'sim:acid_base',
  '합성':       'sim:synthesis',
  '분해':       'sim:decomposition',
  '이중치환':   'sim:double_displacement',
  '앙금':       'sim:double_displacement',
  '침전':       'sim:double_displacement',
  '극성':       'H2O',
  '무극성':     'CO2',
  '연소':       'sim:combustion',
};
