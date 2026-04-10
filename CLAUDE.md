\# AI-Board (ChemBoard) - 전자칠판 연동 화학 시뮬레이션 시스템



\## 프로젝트 개요

교사가 아이패드(전자칠판)에 화학식을 판서하고 \[인식] 버튼을 누르면,

AI가 손글씨를 인식하여 해당 화학 개념의 시뮬레이션 애니메이션을 자동 생성하는 교육 도구.

대상: 중·고등학교 화학 수업 (교사 및 학생)



\## 기술 스택

\- Framework: React 19 + Vite 5

\- Language: TypeScript

\- AI/OCR: Google Cloud Vision API — 손글씨 인식 (월 1,000회 무료)

\- 화학 데이터: PubChem API + 자체 분자/반응 데이터베이스

\- 검색: Wikipedia 한국어 API — 화학 개념 검색

\- Deploy: Vercel



\## 현재 상태

\- 판서 캔버스(DrawingCanvas) 구현 완료

\- 화학식 파서(parser.ts) 구현 완료

\- 시뮬레이션 7종 구현 완료 (molecule, reaction, ionic\_bond, covalent\_bond, electron\_config, acid\_base, redox)

\- Google Cloud Vision API 연동 완료 (GoogleVision.ts)

\- Wikipedia 한국어 검색 기능 구현 완료 (WikiSearch.ts)

\- 플로팅 패널(FloatPanel) 시스템 구현 완료 (드래그 이동, 크기 조절)

\- 수업 보조 패널(AssistantPanel) 구현 완료 (인식 기록 + 요약)



\## 폴더 구조

src/

├── App.tsx                    # 메인 앱 (판서 + 시뮬레이션 분할 화면)

├── App.css                    # 전체 스타일

├── main.tsx                   # React 진입점

├── index.css

├── components/

│   ├── DrawingCanvas.tsx      # 판서 캔버스 (터치/펜 입력, 캡처, 팬 이동)

│   ├── GoogleVision.ts        # Google Cloud Vision API OCR 연동

│   ├── AssistantPanel.tsx     # 수업 보조 패널 (인식 기록 + 요약)

│   ├── FloatPanel.tsx         # 드래그 이동/크기 조절 플로팅 패널

│   ├── SelectionOverlay.tsx   # 부분 영역 선택 오버레이

│   ├── SearchResultView.tsx   # Wikipedia 검색 결과 뷰

│   └── WikiSearch.ts          # Wikipedia 한국어 API 검색

├── chemistry/

│   ├── types.ts               # 핵심 타입 정의 (ParseResult, MoleculeData 등)

│   ├── parser.ts              # 화학식/반응식/키워드 파서

│   ├── atomData.ts            # 원소 데이터 (색상, 반지름, 전기음성도 등)

│   ├── moleculeData.ts        # 키워드→시뮬레이션 매핑

│   ├── ionicData.ts           # 이온결합 데이터

│   └── PubChemAPI.ts          # PubChem API 연동

├── simulations/

│   ├── SimulationPanel.tsx    # 시뮬레이션 라우터 (type에 따라 분기)

│   ├── MoleculeViewer.tsx     # 분자 구조 시각화

│   ├── PubChemViewer.tsx      # PubChem 데이터 기반 뷰어

│   ├── ReactionSim.tsx        # 화학 반응 애니메이션

│   ├── IonicBondSim.tsx       # 이온결합 시뮬레이션

│   ├── CovalentBondSim.tsx    # 공유결합 시뮬레이션

│   ├── ElectronConfigSim.tsx  # 전자 배치 시뮬레이션

│   ├── AcidBaseSim.tsx        # 산염기 시뮬레이션

│   └── RedoxSim.tsx           # 산화환원 시뮬레이션

└── assets/



\## 핵심 데이터 흐름

판서 (DrawingCanvas)

→ \[인식] 버튼 클릭

→ Canvas를 base64 이미지로 캡처

→ Google Cloud Vision API로 OCR 전송

→ 인식된 텍스트 반환 (예: "H2O", "2H2+O2→2H2O", "이온결합")

→ parseChemistry(text) 함수로 ParseResult 생성

→ SimulationPanel이 result.type에 따라 시뮬레이션 자동 선택

→ 애니메이션 렌더링



\## 핵심 타입 (src/chemistry/types.ts)



SimulationType: 'molecule' | 'reaction' | 'ionic\_bond' | 'covalent\_bond' | 'electron\_config' | 'acid\_base' | 'redox' | 'unknown'



ParseResult: { type, raw, formula?, molecule?, reaction?, element?, keyword?, description }



MoleculeData: { formula, name, atoms\[], bonds\[], shape?, polarity? }



ReactionData: { equation, reactants\[], products\[], type, description }



\## 시뮬레이션 매칭 규칙 (SimulationPanel.tsx)

\- molecule + formula → PubChemViewer (PubChem에서 조회)

\- ionic\_bond → IonicBondSim

\- covalent\_bond → CovalentBondSim

\- electron\_config → ElectronConfigSim (element prop 전달)

\- acid\_base → AcidBaseSim

\- reaction → ReactionSim (equation, reactionType prop 전달)

\- redox → RedoxSim (Zn + Cu²⁺ 산화환원 애니메이션)



\## 역할 분담

\- A: src/components/ (판서 캔버스, AI 연동 모듈)

\- B: src/simulations/ (시각화 엔진, 시뮬레이션 템플릿)

\- C: src/chemistry/ (화학 파서, API 연동, 서버 프록시)

\- D: docs/ (기획서, AI 리포트, 디자인)

\- 공통 파일 (App.tsx, types.ts): 수정 시 팀원 합의 필요



\## 주요 과제 (우선순위)

1\. ~~GeminiVision.ts → Google Vision API 교체~~ ✅ 완료

2\. ~~redox 시뮬레이션 구현~~ ✅ 완료

3\. 시뮬레이션 품질 향상 및 추가 (B 담당)

4\. iPad Safari 최적화 (A 담당)

5\. AI 리포트 및 문서 작성 (D 담당)



\## 코딩 규칙

\- TypeScript 사용 (any 타입 금지)

\- React 함수형 컴포넌트 + hooks

\- 컴포넌트 파일: PascalCase.tsx / 유틸리티 파일: camelCase.ts

\- API 키는 절대 코드에 직접 작성 금지 → import.meta.env.VITE\_\* 사용

\- console.log는 커밋 전에 제거

\- 새 시뮬레이션 추가 시 SimulationPanel.tsx의 switch문에 등록 필수



\## Git 규칙

\- main 브랜치 직접 push 금지

\- 브랜치: feature/기능이름 (예: feature/claude-api)

\- 커밋 메시지: "타입: 설명" (예: feat: Claude API 연동)

\- 타입: feat, fix, style, docs, refactor, chore

\- PR은 develop 브랜치로 생성

\- 4/13 이후 커밋 절대 금지 (공모전 규정)



\## 자주 쓰는 명령어

\- 개발 서버: npm run dev

\- 빌드: npm run build

\- 린트: npm run lint



