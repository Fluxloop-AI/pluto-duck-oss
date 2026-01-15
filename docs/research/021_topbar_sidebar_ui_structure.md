---
date: 2026-01-15T00:00:00+09:00
researcher: Claude
topic: "상단바와 사이드 패널 UI 구조 분석"
tags: [research, frontend, header, sidebar, tauri, custom-titlebar]
status: complete
---

# Research: 상단바와 사이드 패널 UI 구조 분석

## Research Question
상단바와 사이드 패널 Front UI의 구조와 구현 방식 파악. 특히 상단바 커스텀 구현 상태 확인.

## Summary

이 프로젝트는 **Tauri 2.0 Overlay Titlebar** 방식을 사용하여 커스텀 상단바를 구현했습니다. 네이티브 macOS 창 컨트롤(traffic lights)은 유지하면서, 타이틀은 숨기고 앱 자체 헤더를 배치합니다. 사이드바는 collapsible 구조로 프로젝트 선택, 보드/에셋 탭, 리스트를 포함합니다.

## Detailed Findings

### 1. Tauri 창 설정 (Custom Titlebar 핵심)

**File:** [tauri.conf.json](tauri-shell/src-tauri/tauri.conf.json#L13-L26)

```json
"windows": [
  {
    "label": "main",
    "title": "Pluto Duck",
    "width": 1400,
    "height": 900,
    "minWidth": 800,
    "minHeight": 600,
    "resizable": true,
    "hiddenTitle": true,
    "titleBarStyle": "Overlay",
    "dragDropEnabled": false
  }
]
```

| 설정 | 값 | 의미 |
|------|-----|------|
| `titleBarStyle` | `"Overlay"` | 네이티브 타이틀바가 콘텐츠 위에 오버레이됨. macOS traffic lights(빨/노/초)는 표시됨 |
| `hiddenTitle` | `true` | 네이티브 타이틀 텍스트 숨김 |
| `decorations` | (기본값 true) | 창 테두리/그림자 유지 |

---

### 2. 상단바 (Header) 구조

**File:** [page.tsx:378-416](frontend/pluto_duck_frontend/app/page.tsx#L378-L416)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [76px 빈 공간] │ [◀] │ [Connect Data] │    [드래그 영역]    │ [▶] │
│   (traffic    │사이드│     버튼        │  data-tauri-drag   │채팅 │
│   lights용)   │바토글│                │       region       │토글 │
└─────────────────────────────────────────────────────────────────────────┘
              h-10 (40px), bg-muted
```

#### 주요 스타일
```tsx
<header className="z-10 flex h-10 shrink-0 items-center bg-muted px-3 pl-[76px] pr-3">
```

- **`pl-[76px]`**: macOS traffic lights를 위한 왼쪽 패딩 (핵심!)
- **`h-10`**: 높이 40px
- **`bg-muted`**: 배경색 (테마의 muted 컬러)
- **`z-10`**: 다른 요소 위에 표시

#### 드래그 영역 (창 이동)
```tsx
<div
  data-tauri-drag-region
  className="flex h-full flex-1 select-none items-center justify-center gap-2"
/>
```
- `data-tauri-drag-region`: Tauri가 이 영역을 창 드래그 핸들로 인식
- `flex-1`: 남은 공간 전체 차지
- `select-none`: 텍스트 선택 방지

#### 상단바 버튼 구성

| 위치 | 요소 | 기능 | 라인 |
|------|------|------|------|
| 좌측 | PanelLeftOpen/Close | 사이드바 토글 | 379-389 |
| 좌측 | Connect Data 버튼 | 데이터소스 모달 열기 | 391-398 |
| 중앙 | 드래그 영역 | 창 이동 | 400-403 |
| 우측 | PanelRightOpen/Close | 채팅 패널 토글 | 405-415 |

---

### 3. 사이드바 (Sidebar) 구조

**File:** [page.tsx:436-521](frontend/pluto_duck_frontend/app/page.tsx#L436-L521)

```
┌──────────────────────────────┐
│ [ProjectSelector] [+새보드] │  ← 437-458
├──────────────────────────────┤
│ ┌──────────┬───────────┐    │
│ │  Boards  │  Assets   │    │  ← 462-493 (슬라이딩 탭)
│ └──────────┴───────────┘    │
├──────────────────────────────┤
│ Board 1                      │
│ Board 2 (active)             │  ← 495-508 (BoardList 또는 Assets)
│ Board 3                      │
├──────────────────────────────┤
│ [⚙ Settings]                │  ← 511-520
└──────────────────────────────┘
        w-64 (256px)
```

#### 사이드바 컨테이너
```tsx
<aside className="hidden w-64 border-r border-muted bg-muted transition-all duration-300 lg:flex lg:flex-col">
```
- **`w-64`**: 너비 256px
- **`hidden lg:flex`**: 모바일에서 숨김, lg 이상에서 표시
- **`border-r border-muted`**: 우측 경계선

#### Boards/Assets 토글 탭 (슬라이딩 인디케이터)

**File:** [page.tsx:462-493](frontend/pluto_duck_frontend/app/page.tsx#L462-L493)

```tsx
<div className="relative mb-3 flex rounded-lg bg-card p-1">
  {/* Sliding indicator */}
  <div
    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md bg-primary transition-all duration-200 ease-out ${
      mainView === 'boards' ? 'left-1' : 'left-[50%]'
    }`}
  />
  <button ... >Boards</button>
  <button ... >Assets</button>
</div>
```

- 슬라이딩 인디케이터가 선택된 탭 뒤로 이동
- `mainView` 상태로 'boards' | 'assets' 전환

---

### 4. 레이아웃 계층 구조

**File:** [page.tsx:376-572](frontend/pluto_duck_frontend/app/page.tsx#L376-L572)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Header (h-10)                                 │
├──────────┬──────────────────────────────────────────────────────────────┤
│          │                                                              │
│ Sidebar  │              Main Content Wrapper                            │
│  (w-64)  │         ┌──────────────────────┬─────────────┐              │
│          │         │                      │             │              │
│ Project  │         │    BoardsView /      │    Chat     │              │
│ Selector │         │    AssetListView     │   Panel     │              │
│          │         │                      │  (resizable)│              │
│ Tabs     │         │                      │             │              │
│          │         │                      │             │              │
│ List     │         └──────────────────────┴─────────────┘              │
│          │              rounded-[10px], m-2                            │
│ Settings │                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

#### 메인 콘텐츠 래퍼 (둥근 모서리 영역)
```tsx
<div className={`flex flex-1 overflow-hidden rounded-[10px] bg-background m-2 border border-black/10 ${sidebarCollapsed ? '' : 'ml-0'}`}>
```
- **`rounded-[10px]`**: 둥근 모서리
- **`m-2`**: 여백 (사이드바가 접혀있을 때)
- **`ml-0`**: 사이드바가 펼쳐져 있으면 왼쪽 여백 제거

---

### 5. 상태 관리

| 상태 | 타입 | 용도 | 라인 |
|------|------|------|------|
| `sidebarCollapsed` | boolean | 사이드바 접힘 여부 | 55 |
| `chatPanelCollapsed` | boolean | 채팅 패널 접힘 여부 | 56 |
| `mainView` | 'boards' \| 'assets' | 메인 뷰 모드 | 57 |
| `chatPanelWidth` | number | 채팅 패널 너비 (300-800px) | 59 |

---

### 6. 채팅 패널 리사이즈

**File:** [page.tsx:339-374](frontend/pluto_duck_frontend/app/page.tsx#L339-L374)

```tsx
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  setIsResizing(true);
}, []);

// Mouse move handler restricts width between 300-800px
const newWidth = window.innerWidth - e.clientX;
const minWidth = 300;
const maxWidth = 800;
```

리사이즈 핸들 UI:
```tsx
<div
  onMouseDown={handleMouseDown}
  className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-10 group"
/>
```

---

## Code References

| 파일 | 라인 | 설명 |
|------|------|------|
| [page.tsx](frontend/pluto_duck_frontend/app/page.tsx#L378-L416) | 378-416 | 상단바 (Header) 구현 |
| [page.tsx](frontend/pluto_duck_frontend/app/page.tsx#L436-L521) | 436-521 | 사이드바 (Sidebar) 구현 |
| [page.tsx](frontend/pluto_duck_frontend/app/page.tsx#L462-L493) | 462-493 | Boards/Assets 슬라이딩 탭 |
| [page.tsx](frontend/pluto_duck_frontend/app/page.tsx#L524-L571) | 524-571 | 메인 콘텐츠 영역 |
| [tauri.conf.json](tauri-shell/src-tauri/tauri.conf.json#L13-L26) | 13-26 | Tauri 창 설정 |
| [BoardList.tsx](frontend/pluto_duck_frontend/components/boards/BoardList.tsx) | 전체 | 보드 리스트 컴포넌트 |
| [ProjectSelector.tsx](frontend/pluto_duck_frontend/components/projects/ProjectSelector.tsx) | - | 프로젝트 선택 드롭다운 |

---

## Architecture Insights

### 커스텀 타이틀바 구현 방식

1. **Tauri Overlay 방식 선택 이유**:
   - macOS 네이티브 창 컨트롤(traffic lights) 유지로 OS 일관성 확보
   - 완전 커스텀 타이틀바 대비 구현 복잡도 감소
   - 접근성/사용성 보장

2. **pl-[76px] 패딩의 중요성**:
   - macOS traffic lights 위치: 약 70-76px
   - 이 패딩이 없으면 sidebar toggle 버튼이 traffic lights와 겹침
   - Windows에서는 이 패딩이 불필요할 수 있음 (플랫폼별 처리 필요할 수 있음)

3. **레이아웃 패턴**:
   - Flexbox 기반 3-column 레이아웃
   - 사이드바/채팅패널 독립적 collapse 가능
   - 메인 영역에 둥근 모서리로 시각적 구분

---

## 수정 시 주의사항

1. **상단바 높이 변경 시**: `h-10`(40px) 변경하면 `pl-[76px]`도 재조정 필요할 수 있음
2. **사이드바 너비 변경 시**: `w-64`(256px) 외에 메인 래퍼의 `ml-0` 조건 확인
3. **Traffic lights 영역**: `pl-[76px]`는 macOS 전용, 크로스플랫폼 시 조건부 처리 고려
4. **드래그 영역**: `data-tauri-drag-region`이 있는 div 내에 클릭 가능한 요소 추가 시 이벤트 전파 주의

## Open Questions

1. Windows에서 `pl-[76px]` 패딩이 불필요한 공간을 차지하는지 확인 필요
2. 사이드바 collapse 애니메이션이 `transition-all duration-300`으로 되어있으나 실제 동작 확인 필요
3. 모바일/태블릿 뷰에서 `hidden lg:flex` 처리로 사이드바가 숨겨지는데, 대체 네비게이션 필요 여부
