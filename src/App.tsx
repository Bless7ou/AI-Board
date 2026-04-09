import { useState, useRef, useCallback } from 'react';
import DrawingCanvas from './components/DrawingCanvas';
import type { DrawingCanvasHandle } from './components/DrawingCanvas';
import SimulationPanel from './simulations/SimulationPanel';
import AssistantPanel from './components/AssistantPanel';
import type { AssistantItem } from './components/AssistantPanel';
import { toCleanChem } from './components/AssistantPanel';
import SelectionOverlay from './components/SelectionOverlay';
import FloatPanel from './components/FloatPanel';
import SearchResultView from './components/SearchResultView';
import type { WikiResult } from './components/WikiSearch';
import { searchChemistry } from './components/WikiSearch';
import type { ParseResult } from './chemistry/types';
import { parseChemistry } from './chemistry/parser';
import { recognizeHandwriting, getApiKey, setApiKey } from './components/GoogleVision';
import './App.css';

type Tool = 'pen' | 'eraser';

let itemIdCounter = 0;

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function App() {
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const [playing, setPlaying]           = useState(true);
  const [speed, setSpeed]               = useState(1);
  const [result, setResult]             = useState<ParseResult | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastText, setLastText]         = useState('');
  const [tool, setTool]                 = useState<Tool>('pen');
  const [penColor, setPenColor]         = useState('#ffffff');
  const [penSize, setPenSize]           = useState(3);
  const [manualInput, setManualInput]   = useState('');
  const [showManual, setShowManual]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput]   = useState(getApiKey());
  const [errorMsg, setErrorMsg]         = useState('');
  const [assistantItems, setAssistantItems] = useState<AssistantItem[]>([]);
  const [isSelecting, setIsSelecting]       = useState(false);

  // 검색 관련 state
  const [isSearchMode, setIsSearchMode]     = useState(false);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchError, setSearchError]       = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResult, setSearchResult]     = useState<WikiResult | null>(null);

  // 인식 결과를 파싱하고 어시스턴트 패널에 추가
  const processText = useCallback((text: string) => {
    if (!text.trim()) return null;
    const parsed = parseChemistry(text);
    const clean = toCleanChem(text);
    setAssistantItems(prev => [...prev, {
      id: ++itemIdCounter,
      raw: text,
      clean,
      type: parsed.type,
      description: parsed.description,
      time: nowTime(),
    }]);
    return parsed;
  }, []);

  const handleRecognize = useCallback(async () => {
    if (isRecognizing) return;
    setIsRecognizing(true);
    setErrorMsg('');

    try {
      const dataURL = canvasRef.current?.getImageDataURL() ?? '';
      if (!dataURL) throw new Error('캔버스 이미지를 가져올 수 없습니다.');

      const text = await recognizeHandwriting(dataURL);
      setLastText(text || '(인식 결과 없음)');

      if (!text.trim()) {
        setErrorMsg('화학 내용을 인식하지 못했습니다. 더 크고 명확하게 써주세요.');
        return;
      }

      const parsed = processText(text);
      if (parsed) {
        setResult(parsed);
        if (parsed.type === 'unknown') {
          setErrorMsg(`"${text.slice(0, 40)}" — 알 수 없는 내용입니다.`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인식 오류';
      setErrorMsg(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally {
      setIsRecognizing(false);
    }
  }, [isRecognizing, processText]);

  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    const parsed = processText(manualInput.trim());
    if (parsed) {
      setResult(parsed);
      setLastText(manualInput.trim());
    }
    setShowManual(false);
    setManualInput('');
    setErrorMsg('');
  }, [manualInput, processText]);

  // 검색 영역 선택 후 OCR → Wikipedia 검색
  const handleSearchSelect = useCallback(async (
    x: number, y: number, w: number, h: number, displayW: number, displayH: number
  ) => {
    setIsSearchMode(false);
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    setSearchQuery('');

    try {
      const croppedURL = canvasRef.current?.getCroppedImageDataURL(x, y, w, h, displayW, displayH) ?? '';
      if (!croppedURL) throw new Error('영역을 캡처할 수 없습니다.');

      const text = await recognizeHandwriting(croppedURL);
      if (!text.trim()) throw new Error('텍스트를 인식하지 못했습니다. 더 크고 명확하게 써주세요.');

      // 화학 파서로 키워드 추출
      const parsed = parseChemistry(text);
      const keyword = parsed.formula ?? parsed.element ?? parsed.keyword ?? text.trim().split(/\s+/)[0];
      setSearchQuery(keyword);

      const result = await searchChemistry(keyword);
      setSearchResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '검색 오류';
      setSearchError(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setResult(null);
    setLastText('');
    setErrorMsg('');
    setAssistantItems([]);
  }, []);

  // 부분 인식: 선택 영역 캡처 후 OCR
  const handlePartialRecognize = useCallback(async (
    x: number, y: number, w: number, h: number, displayW: number, displayH: number
  ) => {
    setIsSelecting(false);
    setIsRecognizing(true);
    setErrorMsg('');
    try {
      const croppedURL = canvasRef.current?.getCroppedImageDataURL(x, y, w, h, displayW, displayH) ?? '';
      if (!croppedURL) throw new Error('영역을 캡처할 수 없습니다.');
      const text = await recognizeHandwriting(croppedURL);
      setLastText(text || '(인식 결과 없음)');
      if (!text.trim()) { setErrorMsg('해당 영역에서 화학 내용을 인식하지 못했습니다.'); return; }
      const parsed = processText(text);
      if (parsed) {
        setResult(parsed);
        if (parsed.type === 'unknown') setErrorMsg(`"${text.slice(0, 40)}" — 알 수 없는 내용입니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인식 오류';
      setErrorMsg(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally {
      setIsRecognizing(false);
    }
  }, [processText]);

  const handleSaveApiKey = useCallback(() => {
    setApiKey(apiKeyInput.trim());
    setShowSettings(false);
    setErrorMsg('');
  }, [apiKeyInput]);

  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <div className="header-left">
          <span className="logo">⚗ ChemBoard</span>
          <span className="subtitle">AI 화학 수업 어시스턴트</span>
        </div>
        <div className="header-right">
          <div className="ocr-status ocr-ready">● Google Vision</div>
          <button className="btn-icon" title="수동 입력" onClick={() => setShowManual(v => !v)}>✏️</button>
          <button className="btn-icon" title="설정" onClick={() => { setApiKeyInput(getApiKey()); setShowSettings(v => !v); }}>⚙️</button>
        </div>
      </header>

      {/* 메인: 판서(좌) + 시뮬레이션·수업보조(우) 분할 */}
      <div className="main">

        {/* 캔버스: 전체 화면 */}
        <div className="canvas-area">
          {lastText && (
            <div className="canvas-ocr-badge">
              인식: {lastText.slice(0, 36)}{lastText.length > 36 ? '…' : ''}
            </div>
          )}
          <DrawingCanvas ref={canvasRef} penColor={penColor} penSize={penSize} isEraser={tool === 'eraser'} />
          {isSelecting && (
            <SelectionOverlay
              onSelect={handlePartialRecognize}
              onCancel={() => setIsSelecting(false)}
            />
          )}
          {isSearchMode && (
            <SelectionOverlay
              onSelect={handleSearchSelect}
              onCancel={() => setIsSearchMode(false)}
            />
          )}

          {/* 플로팅: 시뮬레이션 */}
          <FloatPanel
            title="🔬 시뮬레이션"
            defaultX={Math.max(window.innerWidth - 364, 10)}
            defaultY={10}
            defaultW={350}
            defaultH={Math.floor(window.innerHeight * 0.48)}
            minW={200} minH={150} zBase={20}
          >
            <SimulationPanel result={result} playing={playing} speed={speed} />
          </FloatPanel>

          {/* 플로팅: 수업 보조 */}
          <FloatPanel
            title="🤖 수업 보조"
            defaultX={Math.max(window.innerWidth - 364, 10)}
            defaultY={Math.floor(window.innerHeight * 0.48) + 22}
            defaultW={350}
            defaultH={Math.floor(window.innerHeight * 0.38)}
            minW={200} minH={120} zBase={20}
          >
            <AssistantPanel items={assistantItems} />
          </FloatPanel>

          {/* 플로팅: 검색 결과 */}
          <FloatPanel
            title="📖 Wikipedia 검색"
            defaultX={10}
            defaultY={10}
            defaultW={340}
            defaultH={Math.floor(window.innerHeight * 0.55)}
            minW={220} minH={150} zBase={30}
          >
            <SearchResultView
              result={searchResult}
              loading={searchLoading}
              error={searchError}
              query={searchQuery}
            />
          </FloatPanel>

        </div>

      </div>

      {/* 오류 바 */}
      {errorMsg && (
        <div className="error-bar">
          ⚠ {errorMsg}
          <button onClick={() => setErrorMsg('')} className="close-btn">✕</button>
        </div>
      )}

      {/* 수동 입력 오버레이 */}
      {showManual && (
        <div className="manual-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowManual(false); }}>
          <div className="manual-panel">
            <div className="manual-title">✏️ 수동 입력</div>
            <input type="text" className="manual-input" value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="H2O, NaCl, 이온결합, 2H2+O2→2H2O ..." autoFocus />
            <div className="manual-examples">
              {['H2O', 'NaCl', 'CO2', 'NH3', 'CH4', 'C6H12O6', 'CaCO3', '이온결합', '공유결합', '산염기', '2H2+O2→2H2O', 'Na'].map((ex) => (
                <button key={ex} className="example-btn" onClick={() => setManualInput(ex)}>{ex}</button>
              ))}
            </div>
            <div className="manual-actions">
              <button className="btn-primary" onClick={handleManualSubmit}>시뮬레이션 실행</button>
              <button className="btn-secondary" onClick={() => setShowManual(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 오버레이 */}
      {showSettings && (
        <div className="manual-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="manual-panel">
            <div className="manual-title">⚙️ 설정 — Google Vision API 키</div>
            <p style={{ fontSize: '12px', color: '#5577aa', marginBottom: '12px', lineHeight: 1.7 }}>
              손글씨 인식에 Google Cloud Vision API를 사용합니다.<br />
              <strong style={{ color: '#4488aa' }}>월 1,000회 무료</strong> — 수업용으로 충분합니다.<br />
              <span style={{ color: '#335566' }}>console.cloud.google.com → Cloud Vision API 활성화</span>
            </p>
            <input type="text" className="manual-input"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="AIzaSy..." />
            <div className="manual-actions">
              <button className="btn-primary" onClick={handleSaveApiKey}>저장</button>
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 컨트롤바 */}
      <div className="controlbar">

        {/* 그리기 도구 */}
        <button className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="펜">🖊</button>
        <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="지우개">🧹</button>

        <div className="ctrl-divider" />

        {['#ffffff', '#ffdd55', '#ff6b6b', '#66ffaa', '#66bbff'].map((c) => (
          <button key={c} className={`color-btn ${penColor === c ? 'active' : ''}`}
            style={{ background: c }} onClick={() => { setPenColor(c); setTool('pen'); }} />
        ))}

        <div className="ctrl-divider" />

        <input type="range" min={1} max={12} value={penSize}
          onChange={(e) => setPenSize(Number(e.target.value))}
          className="size-slider" title={`펜 크기: ${penSize}`} />

        <div className="ctrl-divider" />

        <button className={`ctrl-btn recognize ${isRecognizing ? 'loading' : ''}`}
          onClick={handleRecognize} disabled={isRecognizing || isSelecting} title="전체 판서 인식">
          {isRecognizing ? '🔄 인식 중...' : '🔍 전체 인식'}
        </button>
        <button
          className={`ctrl-btn partial ${isSelecting ? 'active' : ''}`}
          onClick={() => setIsSelecting(v => !v)}
          disabled={isRecognizing}
          title="드래그로 영역을 선택해 부분 인식"
        >
          ✂️ 부분 인식
        </button>

        <div className="ctrl-divider" />

        <button className={`ctrl-btn ${playing ? 'active' : ''}`}
          onClick={() => setPlaying(v => !v)} title={playing ? '일시정지' : '재생'}>
          {playing ? '⏸' : '▶'}
        </button>

        <div className="ctrl-divider" />

        <span className="ctrl-label">속도</span>
        <button className="ctrl-btn" onClick={() => setSpeed(s => Math.max(0.25, +(s - 0.25).toFixed(2)))}>◀</button>
        <span className="speed-display">{speed.toFixed(2)}x</span>
        <button className="ctrl-btn" onClick={() => setSpeed(s => Math.min(3, +(s + 0.25).toFixed(2)))}>▶</button>

        <div className="ctrl-divider" />

        <button className="ctrl-btn clear" onClick={handleClear} title="전체 초기화">🗑 초기화</button>

        <div className="ctrl-divider" />

        <button
          className={`ctrl-btn search ${isSearchMode ? 'active' : ''}`}
          onClick={() => { setIsSearchMode(v => !v); setIsSelecting(false); }}
          disabled={isRecognizing || isSelecting}
          title="영역을 드래그해서 화학 내용 검색"
        >
          {isSearchMode ? '✕ 검색 취소' : '📖 검색'}
        </button>
      </div>

    </div>
  );
}

/* ── SummaryModal에서 재사용 ── */
const TYPE_LABEL: Record<string, string> = {
  molecule: '분자', reaction: '반응식', ionic_bond: '이온결합',
  covalent_bond: '공유결합', electron_config: '전자배치',
  acid_base: '산염기', redox: '산화환원', unknown: '기타',
};

export function SummaryModal({ items, onClose }: { items: AssistantItem[]; onClose: () => void }) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const molecules  = [...new Set(items.filter(i => i.type === 'molecule').map(i => i.clean))];
  const reactions  = [...new Set(items.filter(i => i.type === 'reaction').map(i => i.clean))];
  const concepts   = [...new Set(items.filter(i =>
    ['ionic_bond','covalent_bond','acid_base','redox','electron_config'].includes(i.type)
  ).map(i => TYPE_LABEL[i.type] ?? i.type))];

  const handleCopy = () => {
    const lines = [
      `📚 화학 수업 요약 — ${today}`,
      '',
      molecules.length  ? `[다룬 화학식]\n${molecules.join(', ')}`  : '',
      reactions.length  ? `[다룬 반응식]\n${reactions.join('\n')}` : '',
      concepts.length   ? `[다룬 개념]\n${concepts.join(', ')}`    : '',
      '',
      '[수업 흐름]',
      ...items.map(i => `${i.time}  ${TYPE_LABEL[i.type] ?? i.type}  ${i.clean}`),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).catch(() => {});
  };

  return (
    <div className="manual-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="manual-panel" style={{ maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="manual-title">📋 수업 요약 — {today}</div>

        {/* 핵심 내용 */}
        {molecules.length > 0 && (
          <SumSection title="다룬 화학식" color="#4499ff" items={molecules} />
        )}
        {reactions.length > 0 && (
          <SumSection title="다룬 반응식" color="#ff9944" items={reactions} />
        )}
        {concepts.length > 0 && (
          <SumSection title="다룬 개념" color="#aa66ff" items={concepts} />
        )}

        {/* 수업 흐름 타임라인 */}
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(60,100,160,0.2)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', color: '#4466aa', marginBottom: '8px', fontWeight: 700 }}>수업 흐름</div>
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', gap: '10px', alignItems: 'center',
              padding: '4px 0', borderBottom: '1px solid rgba(40,70,110,0.15)',
              fontSize: '12px',
            }}>
              <span style={{ color: '#334466', minWidth: '36px' }}>{item.time}</span>
              <span style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: '8px',
                background: 'rgba(60,100,200,0.15)', color: '#6688cc', minWidth: '50px', textAlign: 'center',
              }}>{TYPE_LABEL[item.type] ?? item.type}</span>
              <span style={{ color: '#aaccff', fontFamily: 'Courier New, monospace' }}>{item.clean}</span>
            </div>
          ))}
        </div>

        <div className="manual-actions" style={{ marginTop: '16px' }}>
          <button className="btn-primary" onClick={handleCopy}>📋 복사</button>
          <button className="btn-secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function SumSection({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', color: '#4466aa', marginBottom: '6px', fontWeight: 700 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {items.map((item, i) => (
          <span key={i} style={{
            padding: '3px 10px', borderRadius: '12px',
            background: `${color}18`, border: `1px solid ${color}33`,
            color, fontSize: '13px', fontFamily: 'Courier New, monospace',
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}
