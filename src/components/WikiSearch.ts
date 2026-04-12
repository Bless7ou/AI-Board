export interface WikiResult {
  title: string;
  extract: string;
  pageUrl: string;
  thumbnail?: string;
  searchedAs: string; // 실제 검색에 사용된 키워드
}

// 화학 용어 → 한국어 위키백과 표제어 직접 매핑
const WIKI_MAP: Record<string, string> = {
  // 분자
  'H2O':      '물 (화학)',
  'NaCl':     '염화나트륨',
  'CO2':      '이산화탄소',
  'NH3':      '암모니아',
  'CH4':      '메테인',
  'HCl':      '염화수소',
  'H2SO4':    '황산',
  'HNO3':     '질산',
  'NaOH':     '수산화나트륨',
  'KOH':      '수산화칼륨',
  'CaCO3':    '탄산칼슘',
  'Fe2O3':    '산화철(III)',
  'C6H12O6':  '포도당',
  'N2':       '질소',
  'O2':       '산소',
  'H2':       '수소',
  'Cl2':      '염소',
  'Na2CO3':   '탄산나트륨',
  // 원소
  'Na':  '나트륨',
  'Cl':  '염소',
  'Fe':  '철',
  'Ca':  '칼슘',
  'Mg':  '마그네슘',
  'Al':  '알루미늄',
  'Cu':  '구리',
  'Zn':  '아연',
  'K':   '칼륨',
  'S':   '황',
  'P':   '인',
  'C':   '탄소',
  'N':   '질소',
  'O':   '산소',
  'H':   '수소',
  'He':  '헬륨',
  'Li':  '리튬',
  'Ag':  '은',
  'Au':  '금',
  'Pb':  '납',
  // 개념
  '이온결합':  '이온결합',
  '공유결합':  '공유결합',
  '금속결합':  '금속결합',
  '산화환원':  '산화-환원 반응',
  '산염기':   '산-염기 반응',
  '중화':     '중화반응',
  '연소':     '연소 (화학)',
  '극성':     '극성분자',
  '무극성':   '무극성분자',
  '전기음성도': '전기음성도',
  '동적평형':  '화학평형',
  '르샤틀리에': '르 샤틀리에 원리',
};

async function fetchSummary(title: string, searchedAs: string): Promise<WikiResult> {
  const resp = await fetch(
    `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  if (!resp.ok) throw new Error(`"${title}" 페이지 없음`);
  const d = await resp.json() as {
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
    thumbnail?: { source?: string };
  };
  return {
    title:     d.title ?? title,
    extract:   d.extract ?? '',
    pageUrl:   d.content_urls?.desktop?.page
               ?? `https://ko.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    thumbnail: d.thumbnail?.source,
    searchedAs,
  };
}

async function searchThenFetch(query: string, searchedAs: string): Promise<WikiResult> {
  const resp = await fetch(
    `https://ko.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=5`
  );
  if (!resp.ok) throw new Error('Wikipedia 검색 실패');
  const d = await resp.json() as { query?: { search?: Array<{ title: string }> } };
  const hits = d.query?.search ?? [];
  if (hits.length === 0) throw new Error(`"${query}"에 대한 결과가 없습니다`);
  return fetchSummary(hits[0].title, searchedAs);
}

/** 화학 키워드로 한국어 위키백과 검색 */
export async function searchChemistry(keyword: string): Promise<WikiResult> {
  const key = keyword.trim();

  // 1. 직접 매핑 표제어로 바로 조회
  const mapped = WIKI_MAP[key];
  if (mapped) {
    try { return await fetchSummary(mapped, key); } catch { /* fallthrough */ }
  }

  // 2. 키워드 그대로 표제어 조회
  try { return await fetchSummary(key, key); } catch { /* fallthrough */ }

  // 3. "화학 {키워드}" 검색으로 fallback
  return searchThenFetch(`${key} 화학`, key);
}
