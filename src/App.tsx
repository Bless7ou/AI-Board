import { useState, useRef, useCallback } from 'react';
import DrawingCanvas from './components/DrawingCanvas';
import type { DrawingCanvasHandle } from './components/DrawingCanvas';
import SimulationPanel from './simulations/SimulationPanel';
import type { ParseResult } from './chemistry/types';
import { parseChemistry } from './chemistry/parser';
import { recognizeHandwriting, getApiKey, setApiKey } from './components/GeminiVision';
import './App.css';

type Tool = 'pen' | 'eraser';

export default function App() {
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastText, setLastText] = useState('');
  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState('#ffffff');
  const [penSize, setPenSize] = useState(3);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [errorMsg, setErrorMsg] = useState('');

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

      const parsed = parseChemistry(text);
      setResult(parsed);
      if (parsed.type === 'unknown') {
        setErrorMsg(`"${text.slice(0, 40)}" — 알 수 없는 내용입니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인식 오류';
      setErrorMsg(msg);
      if (msg.includes('API 키')) setShowSettings(true);
    } finally {
      setIsRecognizing(false);
    }
  }, [isRecognizing]);

  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    const parsed = parseChemistry(manualInput.trim());
    setResult(parsed);
    setLastText(manualInput.trim());
    setShowManual(false);
    setManualInput('');
    setErrorMsg('');
  }, [manualInput]);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setResult(null);
    setLastText('');
    setErrorMsg('');
  }, []);

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
          <span className="subtitle">화학 판서 시뮬레이터</span>
        </div>
        <div className="header-right">
          <div className="ocr-status ocr-ready">● Gemini Vision</div>
          <button className="btn-icon" title="수동 입력" onClick={() => setShowManual(v => !v)}>✏️</button>
          <button className="btn-icon" title="설정" onClick={() => { setApiKeyInput(getApiKey()); setShowSettings(v => !v); }}>⚙️</button>
        </div>
      </header>

      {/* 메인 분할 화면 */}
      <div className="main">
        <div className="panel panel-left">
          <div className="panel-title">
            <span>📝 판서 영역</span>
            {lastText && (
              <span className="ocr-result">
                인식: {lastText.slice(0, 30)}{lastText.length > 30 ? '…' : ''}
              </span>
            )}
          </div>
          <div className="canvas-wrap">
            <DrawingCanvas ref={canvasRef} penColor={penColor} penSize={penSize} isEraser={tool === 'eraser'} />
          </div>
          <div className="toolbar">
            <button className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="펜">🖊</button>
            <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="지우개">🧹</button>
            <div className="separator" />
            {['#ffffff', '#ffdd55', '#ff6b6b', '#66ffaa', '#66bbff'].map((c) => (
              <button key={c} className={`color-btn ${penColor === c ? 'active' : ''}`}
                style={{ background: c }} onClick={() => { setPenColor(c); setTool('pen'); }} />
            ))}
            <div className="separator" />
            <span className="ctrl-label" style={{ fontSize: '11px' }}>크기</span>
            <input type="range" min={1} max={12} value={penSize}
              onChange={(e) => setPenSize(Number(e.target.value))}
              className="size-slider" title={`펜 크기: ${penSize}`} />
          </div>
        </div>

        <div className="panel panel-right">
          <div className="panel-title">
            <span>🔬 시뮬레이션</span>
            {result && <span className="sim-desc">{result.description}</span>}
          </div>
          <div className="sim-wrap">
            <SimulationPanel result={result} playing={playing} speed={speed} />
          </div>
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
            <div className="manual-title">수동 입력</div>
            <input type="text" className="manual-input" value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="H2O, NaCl, 이온결합, 2H2+O2→2H2O ..." autoFocus />
            <div className="manual-examples">
              {['H2O', 'NaCl', 'CO2', 'NH3', 'CH4', '이온결합', '공유결합', '산염기', '2H2+O2→2H2O', 'Na', 'Cl', 'N2'].map((ex) => (
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
            <div className="manual-title">⚙️ 설정 — Gemini API 키</div>
            <p style={{ fontSize: '12px', color: '#5577aa', marginBottom: '12px', lineHeight: 1.6 }}>
              손글씨 인식에 Google Gemini Vision API를 사용합니다.<br />
              키는 이 기기에만 저장됩니다.
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
        <button className={`ctrl-btn recognize ${isRecognizing ? 'loading' : ''}`}
          onClick={handleRecognize} disabled={isRecognizing} title="판서 인식">
          {isRecognizing ? '🔄 인식 중...' : '🔍 인식'}
        </button>

        <div className="ctrl-divider" />

        <button className={`ctrl-btn ${playing ? 'active' : ''}`}
          onClick={() => setPlaying(v => !v)} title={playing ? '일시정지' : '재생'}>
          {playing ? '⏸' : '▶'}
        </button>

        <div className="ctrl-divider" />

        <span className="ctrl-label">속도</span>
        <button className="ctrl-btn" onClick={() => setSpeed(s => Math.max(0.25, +(s - 0.25).toFixed(2)))} title="느리게">◀</button>
        <span className="speed-display">{speed.toFixed(2)}x</span>
        <button className="ctrl-btn" onClick={() => setSpeed(s => Math.min(3, +(s + 0.25).toFixed(2)))} title="빠르게">▶</button>

        <div className="ctrl-divider" />

        <button className="ctrl-btn clear" onClick={handleClear} title="초기화">🗑 초기화</button>
      </div>
    </div>
  );
}
