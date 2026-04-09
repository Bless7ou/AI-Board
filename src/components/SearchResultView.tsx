import type { WikiResult } from './WikiSearch';

interface Props {
  result:  WikiResult | null;
  loading: boolean;
  error:   string;
  query:   string;
}

export default function SearchResultView({ result, loading, error, query }: Props) {
  const base: React.CSSProperties = {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 20, textAlign: 'center',
    color: '#4a6a99',
  };

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div style={base}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'spin 1.2s linear infinite' }}>🔍</div>
        <div style={{ fontSize: 14, color: '#6699cc', fontWeight: 600 }}>Wikipedia 검색 중...</div>
        {query && <div style={{ fontSize: 12, marginTop: 6, color: '#446688', fontFamily: 'monospace' }}>{query}</div>}
        <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
      </div>
    );
  }

  /* ── 오류 ── */
  if (error) {
    return (
      <div style={base}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 13, color: '#ff8866' }}>{error}</div>
        <div style={{ fontSize: 11, marginTop: 8, color: '#664433' }}>
          더 명확하게 쓴 후 다시 스캔해보세요
        </div>
      </div>
    );
  }

  /* ── 초기 안내 ── */
  if (!result) {
    return (
      <div style={base}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📖</div>
        <div style={{ fontSize: 14, color: '#3a5878', fontWeight: 600, marginBottom: 8 }}>
          화학 내용 검색
        </div>
        <div style={{ fontSize: 12, color: '#2a4060', lineHeight: 1.8 }}>
          하단의 <strong style={{ color: '#5588aa' }}>🔍 검색</strong> 버튼을 누르고<br />
          칠판의 화학식·키워드를 드래그하면<br />
          관련 정보를 찾아드립니다
        </div>
      </div>
    );
  }

  /* ── 결과 ── */
  return (
    <div style={{
      width: '100%', height: '100%',
      overflowY: 'auto',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      background: 'transparent',
    }}>
      {/* 검색어 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: 'rgba(60,120,240,0.15)',
          border: '1px solid rgba(60,120,240,0.3)',
          color: '#6699cc',
        }}>
          검색어: {result.searchedAs}
        </span>
      </div>

      {/* 제목 */}
      <div style={{
        fontSize: 16, fontWeight: 700, color: '#aaccff',
        borderBottom: '1px solid rgba(60,100,180,0.25)',
        paddingBottom: 8,
      }}>
        {result.title}
      </div>

      {/* 썸네일 */}
      {result.thumbnail && (
        <img
          src={result.thumbnail}
          alt={result.title}
          style={{
            width: '100%', maxHeight: 140,
            objectFit: 'contain',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
          }}
        />
      )}

      {/* 본문 요약 */}
      <div style={{
        fontSize: 12, color: '#8aaccc', lineHeight: 1.8,
        flex: 1,
      }}>
        {result.extract.length > 700
          ? result.extract.slice(0, 700) + '…'
          : result.extract}
      </div>

      {/* 위키 링크 */}
      <a
        href={result.pageUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          fontSize: 12, color: '#4488cc',
          textDecoration: 'none',
          padding: '5px 12px',
          border: '1px solid rgba(60,120,200,0.35)',
          borderRadius: 8,
          background: 'rgba(30,60,120,0.2)',
          textAlign: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        📖 Wikipedia에서 전체 보기 →
      </a>
    </div>
  );
}
