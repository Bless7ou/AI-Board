import { useState, useRef, useCallback, useEffect } from 'react';
import DrawingCanvas from './components/DrawingCanvas';
import type { DrawingCanvasHandle, ToolType, EraserMode } from './components/DrawingCanvas';
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

let itemIdCounter = 0;
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IcPen = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M13 3L15.5 5.5L7.5 13.5H5V11L13 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 5L13.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IcEraser = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M15 5.5L13 3.5L5 11.5L6.5 15H10.5L15 10.5V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 15H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcLaser = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.2" fill="#ff4030" opacity="0.9"/>
    <circle cx="9" cy="9" r="2.2" stroke="#ff6040" strokeWidth="1.2"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M12.8 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4" stroke="rgba(255,80,50,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IcUndo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 7C3 4.79 4.79 3 7 3C9.21 3 11 4.79 11 7C11 9.21 9.21 11 7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 5L3 7L1 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcRedo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13 7C13 4.79 11.21 3 9 3C6.79 3 5 4.79 5 7C5 9.21 6.79 11 9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M11 5L13 7L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcLasso = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 2.5C5.5 2.5 3 5 3 7.5C3 10 5 12.5 9 12.5C13 12.5 15 10 15 7.5C15 5.5 13.5 3.8 11.5 3"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2.5 2"/>
    <path d="M9 12.5V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PEN_COLORS = ['#ffffff','#ffdd55','#ff6b6b','#66ffaa','#66bbff','#ff88dd','#ffaa55'];
const ERASER_SIZES = [12, 24, 40, 60];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const cvRef  = useRef<DrawingCanvasHandle>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Tool
  const [tool,         setTool]         = useState<ToolType>('pen');
  const [eraserMode,   setEraserMode]   = useState<EraserMode>('point');
  const [penColor,     setPenColor]     = useState('#ffffff');
  const [penSize,      setPenSize]      = useState(4);
  const [eraserSize,   setEraserSize]   = useState(24);
  const [toolExpanded, setToolExpanded] = useState(false);
  const [penMenu,      setPenMenu]      = useState(false);
  const [eraserMenu,   setEraserMenu]   = useState(false);

  // Sim
  const [playing, setPlaying] = useState(true);
  const [speed,   setSpeed]   = useState(1);
  const [result,  setResult]  = useState<ParseResult | null>(null);

  // OCR
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastText,      setLastText]      = useState('');
  const [isSelecting,   setIsSelecting]   = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');

  // Panels
  const [assistantItems, setAssistantItems] = useState<AssistantItem[]>([]);
  const [showManual,     setShowManual]     = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [apiKeyInput,    setApiKeyInput]    = useState(getApiKey());
  const [manualInput,    setManualInput]    = useState('');

  // Search
  const [isSearchMode,  setIsSearchMode]  = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,   setSearchError]   = useState('');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResult,  setSearchResult]  = useState<WikiResult | null>(null);
  const [showSearch,    setShowSearch]    = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); cvRef.current?.undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); cvRef.current?.redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Close FAB/menus on outside tap
  useEffect(() => {
    const h = (e: PointerEvent) => {
      if (fabRef.current?.contains(e.target as Node)) return;
      setToolExpanded(false);
      setPenMenu(false);
      setEraserMenu(false);
    };
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, []);

  // ── FAB handlers ─────────────────────────────────────────────────────────
  const handleFabClick = useCallback(() => {
    setToolExpanded(v => !v);
    setPenMenu(false);
    setEraserMenu(false);
  }, []);

  const handleToolSelect = useCallback((t: ToolType) => {
    if (t === tool) {
      if (t === 'pen') { setPenMenu(v => !v); setEraserMenu(false); }
      else if (t === 'eraser') { setEraserMenu(v => !v); setPenMenu(false); }
      else { setToolExpanded(false); }
    } else {
      setTool(t);
      setToolExpanded(false);
      setPenMenu(false);
      setEraserMenu(false);
    }
  }, [tool]);

  // ── Core handlers ─────────────────────────────────────────────────────────
  const processText = useCallback((text: string) => {
    if (!text.trim()) return null;
    const parsed = parseChemistry(text);
    const clean  = toCleanChem(text);
    setAssistantItems(prev => [...prev, {
      id: ++itemIdCounter, raw: text, clean,
      type: parsed.type, description: parsed.description, time: nowTime(),
    }]);
    return parsed;
  }, []);

  const handleRecognize = useCallback(async () => {
    if (isRecognizing) return;
    setIsRecognizing(true); setErrorMsg('');
    try {
      const url = cvRef.current?.getImageDataURL() ?? '';
      if (!url) throw new Error('캔버스 이미지를 가져올 수 없습니다.');
      const text = await recognizeHandwriting(url);
      setLastText(text || '(인식 결과 없음)');
      if (!text.trim()) { setErrorMsg('화학 내용을 인식하지 못했습니다.'); return; }
      const parsed = processText(text);
      if (parsed) {
        setResult(parsed);
        if (parsed.type === 'unknown') setErrorMsg(`"${text.slice(0,40)}" — 알 수 없는 내용입니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인식 오류';
      setErrorMsg(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally { setIsRecognizing(false); }
  }, [isRecognizing, processText]);

  const handlePartial = useCallback(async (x: number, y: number, w: number, h: number, dW: number, dH: number) => {
    setIsSelecting(false); setIsRecognizing(true); setErrorMsg('');
    try {
      const url = cvRef.current?.getCroppedImageDataURL(x, y, w, h, dW, dH) ?? '';
      if (!url) throw new Error('영역을 캡처할 수 없습니다.');
      const text = await recognizeHandwriting(url);
      setLastText(text || '(인식 결과 없음)');
      if (!text.trim()) { setErrorMsg('해당 영역에서 인식하지 못했습니다.'); return; }
      const parsed = processText(text);
      if (parsed) {
        setResult(parsed);
        if (parsed.type === 'unknown') setErrorMsg(`"${text.slice(0,40)}" — 알 수 없는 내용입니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인식 오류';
      setErrorMsg(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally { setIsRecognizing(false); }
  }, [processText]);

  const handleSearchSelect = useCallback(async (x: number, y: number, w: number, h: number, dW: number, dH: number) => {
    setIsSearchMode(false); setSearchLoading(true); setSearchError('');
    setSearchResult(null); setSearchQuery(''); setShowSearch(true);
    try {
      const url = cvRef.current?.getCroppedImageDataURL(x, y, w, h, dW, dH) ?? '';
      if (!url) throw new Error('영역을 캡처할 수 없습니다.');
      const text = await recognizeHandwriting(url);
      if (!text.trim()) throw new Error('텍스트를 인식하지 못했습니다.');
      const parsed  = parseChemistry(text);
      const keyword = parsed.formula ?? parsed.element ?? parsed.keyword ?? text.trim().split(/\s+/)[0];
      setSearchQuery(keyword);
      setSearchResult(await searchChemistry(keyword));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : '검색 오류');
    } finally { setSearchLoading(false); }
  }, []);

  const handleClear = useCallback(() => {
    cvRef.current?.clear();
    setResult(null); setLastText(''); setErrorMsg(''); setAssistantItems([]);
  }, []);

  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    const parsed = processText(manualInput.trim());
    if (parsed) { setResult(parsed); setLastText(manualInput.trim()); }
    setShowManual(false); setManualInput(''); setErrorMsg('');
  }, [manualInput, processText]);

  const noResult = result === null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="canvas-area">

        <DrawingCanvas
          ref={cvRef}
          penColor={penColor} penSize={penSize}
          tool={tool} eraserMode={eraserMode} eraserSize={eraserSize}
        />

        {isSelecting && <SelectionOverlay onSelect={handlePartial} onCancel={() => setIsSelecting(false)} />}
        {isSearchMode && <SelectionOverlay onSelect={handleSearchSelect} onCancel={() => setIsSearchMode(false)} />}

        {lastText && (
          <div className="ocr-badge">
            인식: {lastText.slice(0, 36)}{lastText.length > 36 ? '…' : ''}
          </div>
        )}

        {/* ── TOP-LEFT: Undo / Redo / Lasso ── */}
        <div className="float-top-left">
          <button className="icon-btn" onClick={() => cvRef.current?.undo()} title="되돌리기 (Ctrl+Z)">
            <IcUndo />
          </button>
          <button className="icon-btn" onClick={() => cvRef.current?.redo()} title="다시실행 (Ctrl+⇧+Z)">
            <IcRedo />
          </button>
          <div className="icon-divider" />
          <button
            className={`icon-btn ${isSelecting ? 'active' : ''}`}
            onClick={() => { setIsSelecting(v => !v); setIsSearchMode(false); }}
            title="영역 선택 인식"
          >
            <IcLasso />
          </button>
        </div>

        {/* ── TOP-RIGHT: Sim controls + Settings ── */}
        <div className="top-controls">
          {result && (
            <>
              <button className="top-btn" onClick={() => setPlaying(v => !v)} title={playing ? '일시정지' : '재생'}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="top-btn" style={{fontSize:10}} onClick={() => setSpeed(s => Math.max(0.25, +(s-0.25).toFixed(2)))}>◀</button>
              <span className="speed-badge">{speed.toFixed(2)}×</span>
              <button className="top-btn" style={{fontSize:10}} onClick={() => setSpeed(s => Math.min(3, +(s+0.25).toFixed(2)))}>▶</button>
              <div className="icon-divider" />
            </>
          )}
          <div className={`ocr-dot ${isRecognizing ? 'ocr-loading' : 'ocr-ready'}`} title="Google Vision API" />
          <button className="top-btn" title="수동 입력" onClick={() => setShowManual(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 13h11M8.5 2.5L12.5 6.5L5 14H1V10L8.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="top-btn" title="설정" onClick={() => { setApiKeyInput(getApiKey()); setShowSettings(v => !v); }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M11.77 3.23l-1.06 1.06M4.29 10.71l-1.06 1.06M11.77 11.77l-1.06-1.06M4.29 4.29L3.23 3.23" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Floating panels ── */}
        <FloatPanel title="🔬 시뮬레이션"
          defaultX={Math.max(window.innerWidth - 364, 10)} defaultY={54}
          defaultW={350} defaultH={Math.floor(window.innerHeight * 0.44)}
          minW={200} minH={140} zBase={20} hidden={noResult}>
          <SimulationPanel result={result} playing={playing} speed={speed} />
        </FloatPanel>

        <FloatPanel title="🤖 수업 보조"
          defaultX={Math.max(window.innerWidth - 364, 10)}
          defaultY={54 + Math.floor(window.innerHeight * 0.44) + 14}
          defaultW={350} defaultH={Math.floor(window.innerHeight * 0.33)}
          minW={200} minH={110} zBase={20} hidden={noResult}>
          <AssistantPanel items={assistantItems} />
        </FloatPanel>

        <FloatPanel title="📖 Wikipedia"
          defaultX={10} defaultY={60}
          defaultW={340} defaultH={Math.floor(window.innerHeight * 0.52)}
          minW={220} minH={140} zBase={30} hidden={!showSearch}>
          <div style={{ position:'relative', height:'100%' }}>
            <button onClick={() => setShowSearch(false)} className="panel-close">✕</button>
            <SearchResultView result={searchResult} loading={searchLoading} error={searchError} query={searchQuery} />
          </div>
        </FloatPanel>

        {/* ── BOTTOM-LEFT: Tool FAB ── */}
        <div className="tool-fab-wrap" ref={fabRef}>
          {/* List expands upward (absolutely positioned, doesn't push FAB) */}
          <div className={`tool-fab-list ${toolExpanded ? 'expanded' : ''}`}>
            {/* Laser – top (farthest) */}
            <div className="tool-fab-item">
              <button
                className={`tool-fab-tool-btn ${tool === 'laser' ? 'laser-active' : ''}`}
                onClick={() => handleToolSelect('laser')}
                title="레이저 포인터"
              ><IcLaser /></button>
            </div>
            {/* Eraser – middle */}
            <div className="tool-fab-item">
              <button
                className={`tool-fab-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => handleToolSelect('eraser')}
                title="지우개"
              ><IcEraser /></button>
              {eraserMenu && (
                <div className="tool-options-popup">
                  <div className="popup-label">종류</div>
                  <div className="eraser-modes">
                    <button className={`mode-btn ${eraserMode === 'point' ? 'active' : ''}`} onClick={() => setEraserMode('point')}>
                      <IcEraser /> 일반
                    </button>
                    <button className={`mode-btn ${eraserMode === 'stroke' ? 'active' : ''}`} onClick={() => setEraserMode('stroke')}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7C2 4 4 2 7 2C10 2 12 4 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M2 7L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1.5 2.5"/>
                      </svg> 획
                    </button>
                  </div>
                  <div className="popup-label">크기 <span className="popup-val">{eraserSize}px</span></div>
                  <div className="eraser-sizes">
                    {ERASER_SIZES.map(sz => (
                      <button key={sz} className={`sz-btn ${eraserSize === sz ? 'active' : ''}`} onClick={() => setEraserSize(sz)}>
                        <div style={{ width: sz/3, height: sz/3, background:'currentColor', borderRadius:'50%' }} />
                      </button>
                    ))}
                  </div>
                  <div className="popup-divider" />
                  <button className="clear-all-btn" onClick={() => { handleClear(); setEraserMenu(false); setToolExpanded(false); }}>
                    🗑 전체 지우기
                  </button>
                </div>
              )}
            </div>
            {/* Pen – bottom (closest to FAB) */}
            <div className="tool-fab-item">
              <button
                className={`tool-fab-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                onClick={() => handleToolSelect('pen')}
                title="펜"
              ><IcPen /></button>
              {penMenu && (
                <div className="tool-options-popup">
                  <div className="popup-label">색상</div>
                  <div className="popup-colors">
                    {PEN_COLORS.map(c => (
                      <button key={c}
                        className={`color-dot ${penColor === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => { setPenColor(c); setPenMenu(false); }}
                      />
                    ))}
                  </div>
                  <div className="popup-label">굵기 <span className="popup-val">{penSize}px</span></div>
                  <input type="range" min={1} max={20} value={penSize}
                    onChange={e => setPenSize(Number(e.target.value))} className="popup-slider" />
                  <div className="pen-preview">
                    <div style={{ width: penSize, height: penSize, background: penColor, borderRadius: '50%' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main FAB */}
          <button
            className={`tool-fab-btn${tool === 'laser' ? ' laser' : ''}`}
            onClick={handleFabClick}
            title="도구 선택"
          >
            {tool === 'pen'    && <IcPen />}
            {tool === 'eraser' && <IcEraser />}
            {tool === 'laser'  && <IcLaser />}
          </button>
        </div>

        {/* ── BOTTOM-RIGHT: Recognize / Search ── */}
        <div className="float-bottom-right">
          <button
            className={`action-fab${isSearchMode ? ' search-active' : ''}`}
            onClick={() => { setIsSearchMode(v => !v); setIsSelecting(false); }}
            disabled={isRecognizing || isSelecting}
            title="영역 검색"
          >
            <span className="action-fab-icon">📖</span>
            <span className="action-fab-label">검색</span>
          </button>
          <button
            className={`action-fab recognize-fab${isRecognizing ? ' loading' : ''}`}
            onClick={handleRecognize}
            disabled={isRecognizing || isSelecting}
            title="전체 인식"
          >
            <span className="action-fab-icon">{isRecognizing ? '…' : '🔍'}</span>
            <span className="action-fab-label">{isRecognizing ? '인식 중' : '인식'}</span>
          </button>
        </div>

      </div>{/* /canvas-area */}

      {/* ── Error bar ── */}
      {errorMsg && (
        <div className="error-bar">
          ⚠ {errorMsg}
          <button onClick={() => setErrorMsg('')} className="close-btn">✕</button>
        </div>
      )}

      {/* ── Manual input modal ── */}
      {showManual && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowManual(false); }}>
          <div className="modal">
            <div className="modal-title">수동 입력</div>
            <input className="modal-input" type="text" value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="H2O, NaCl, 이온결합, 2H2+O2→2H2O …" autoFocus />
            <div className="modal-chips">
              {['H2O','NaCl','CO2','NH3','CH4','C6H12O6','CaCO3','이온결합','공유결합','산염기','2H2+O2→2H2O','Na'].map(ex => (
                <button key={ex} className="chip" onClick={() => setManualInput(ex)}>{ex}</button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleManualSubmit}>실행</button>
              <button className="btn-secondary" onClick={() => setShowManual(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="modal">
            <div className="modal-title">설정 — Google Vision API 키</div>
            <p style={{fontSize:12,color:'#4a6a80',lineHeight:1.7,marginBottom:12}}>
              손글씨 인식에 Google Cloud Vision API를 사용합니다.<br/>
              <strong style={{color:'#3a88aa'}}>월 1,000회 무료</strong><br/>
              <span style={{color:'#2a4455'}}>console.cloud.google.com → Cloud Vision API 활성화</span>
            </p>
            <input className="modal-input" type="text" value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setApiKey(apiKeyInput.trim()); setShowSettings(false); setErrorMsg(''); } }}
              placeholder="AIzaSy…" />
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => { setApiKey(apiKeyInput.trim()); setShowSettings(false); setErrorMsg(''); }}>저장</button>
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SummaryModal (exported for external use) ────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  molecule:'분자', reaction:'반응식', ionic_bond:'이온결합',
  covalent_bond:'공유결합', electron_config:'전자배치',
  acid_base:'산염기', redox:'산화환원', unknown:'기타',
};
export function SummaryModal({ items, onClose }: { items: AssistantItem[]; onClose: () => void }) {
  const today = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const mols = [...new Set(items.filter(i=>i.type==='molecule').map(i=>i.clean))];
  const rxns = [...new Set(items.filter(i=>i.type==='reaction').map(i=>i.clean))];
  const cons = [...new Set(items.filter(i=>['ionic_bond','covalent_bond','acid_base','redox','electron_config'].includes(i.type)).map(i=>TYPE_LABEL[i.type]??i.type))];
  const handleCopy = () => {
    const lines=[`📚 화학 수업 요약 — ${today}`,'',
      mols.length?`[화학식]\n${mols.join(', ')}`:'',
      rxns.length?`[반응식]\n${rxns.join('\n')}`:'',
      cons.length?`[개념]\n${cons.join(', ')}`:'',
      '','[수업 흐름]',...items.map(i=>`${i.time}  ${TYPE_LABEL[i.type]??i.type}  ${i.clean}`),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).catch(()=>{});
  };
  return (
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:520,maxHeight:'80vh',overflowY:'auto'}}>
        <div className="modal-title">📋 수업 요약 — {today}</div>
        {mols.length>0&&<SumSec title="화학식" color="#4499ff" items={mols}/>}
        {rxns.length>0&&<SumSec title="반응식" color="#ff9944" items={rxns}/>}
        {cons.length>0&&<SumSec title="개념"   color="#aa66ff" items={cons}/>}
        <div style={{marginTop:16,borderTop:'1px solid rgba(60,100,160,0.2)',paddingTop:12}}>
          <div style={{fontSize:11,color:'#4466aa',marginBottom:8,fontWeight:700}}>수업 흐름</div>
          {items.map(item=>(
            <div key={item.id} style={{display:'flex',gap:10,alignItems:'center',padding:'4px 0',borderBottom:'1px solid rgba(40,70,110,0.15)',fontSize:12}}>
              <span style={{color:'#334466',minWidth:36}}>{item.time}</span>
              <span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(60,100,200,0.15)',color:'#6688cc',minWidth:50,textAlign:'center'}}>{TYPE_LABEL[item.type]??item.type}</span>
              <span style={{color:'#aaccff',fontFamily:'Courier New,monospace'}}>{item.clean}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions" style={{marginTop:16}}>
          <button className="btn-primary" onClick={handleCopy}>📋 복사</button>
          <button className="btn-secondary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
function SumSec({title,color,items}:{title:string;color:string;items:string[]}) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:'#4466aa',marginBottom:6,fontWeight:700}}>{title}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        {items.map((item,i)=>(
          <span key={i} style={{padding:'3px 10px',borderRadius:12,background:`${color}18`,border:`1px solid ${color}33`,color,fontSize:13,fontFamily:'Courier New,monospace'}}>{item}</span>
        ))}
      </div>
    </div>
  );
}
