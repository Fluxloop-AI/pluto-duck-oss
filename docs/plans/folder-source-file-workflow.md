# Folder Source 기반 File Workflow 기획서 (Draft)

## 1. 배경 / 문제 정의

현재 파일 Import는 기능적으로는 가능하지만 UX 관점에서 다음 문제가 있다.

- **파일 단건 Import에서 “기존 테이블에 추가(append/merge/replace)” 같은 개념이 먼저 노출**되면 초심자에게 너무 어렵다.
- 사용자는 보통 “데이터를 더 올리고 싶다”는 마음으로 `Connect Data`에 들어오는데, 여기서 테이블/머지 개념까지 결정해야 하는 것은 부담이 크다.
- 반면 현실 세계의 데이터는 종종 **폴더 단위로 모인다**. (DB에 여러 테이블이 있듯이 폴더에 여러 파일이 있음)

따라서 **파일 단건은 단순하게**, **폴더는 Source로 등록**하여 “폴더 안에서 파일들을 관리/가공”하도록 모델을 재정리한다.

---

## 2. 목표 (Goals)

1. **단건 파일 Import UX 단순화**
   - “파일 1개 → Dataset 1개 생성”만 제공 (파일 레벨에서 merge/append 등의 개념 제거)
2. **Folder Source 도입**
   - 로컬 디렉토리 경로를 `Source`로 등록하고, 해당 폴더 내 파일을 탐색/선택해 Dataset을 만들거나 기존 Dataset에 추가하도록 한다.
3. **확장 가능한 구조**
   - 향후 DB처럼 **폴더 변경 감지(자동)**로 확장 가능하도록 설계한다.

---

## 3. 비목표 (Non-goals, MVP에서는 하지 않음)

- 파일 단건 Import 단계에서의 append/merge/replace 옵션 제공
- 복잡한 파이프라인/스케줄링/증분 규칙 DSL
- OS 파일시스템 watcher 기반의 “실시간 감지”(후속 단계)

---

## 4. 용어 정리 (Terminology)

- **Assets**: 프로젝트에서 관리하는 자산 전체 뷰
- **Data Sources**: 외부/원천 데이터의 연결/참조 지점
  - **DB Source**: Postgres/Supabase 등 외부 DB 연결
  - **Folder Source**: 로컬 디렉토리 경로(예: `/Users/.../data`)를 Source로 등록한 것
- **Datasets**: 로컬 DuckDB에 존재하는 “사용 가능한 데이터 결과물”
  - 파일에서 생성된 테이블/뷰
  - DB에서 스냅샷으로 만든 테이블 등
- **Analyses**: 저장된 분석 산출물
  - **Queries**: (현재) 저장된 SQL 기반 분석
  - (향후) Reports/Notebooks 확장 가능

---

## 5. IA 제안 (Information Architecture)

```
Assets
├── Analyses
│   └── Queries
└── Data Sources
    ├── Sources
    │   ├── DB Sources
    │   └── Folder Sources   (NEW)
    └── Datasets
        └── Local tables/views created from files/caches/etc
```

---

## 6. UX 플로우

### 6.1 Connect Data (진입점)

#### 문제: 현재는 “파일 타입(CSV/Parquet)” 기준으로 분기되어 있음

현재 Connect Data의 파일 연결 UX가 `CSV`/`Parquet`로 나뉘어 있을 경우, 사용자는 **“무엇을 하고 싶은지(단건 Import vs 폴더 연결)”**보다 먼저 **“포맷이 뭔지”**를 판단해야 한다.

하지만 사용자의 1차 의도는 대체로 다음 중 하나다.
- “파일 하나를 바로 올려서 데이터셋 만들고 싶다”
- “내 폴더에 데이터가 계속 쌓이는데, 그걸 소스로 관리하고 싶다”

따라서 Connect Data에서의 파일 항목은 **파일 타입이 아니라 행동(Use case)** 기준으로 재구성하는 것이 더 편하고 자연스럽다.

#### 제안: Files 섹션을 “행동 기반” 2개 카드로 재구성

**A) Import file (Simple / Quick)**
- 파일 선택(파일피커)
- Dataset 이름(= 생성 테이블명) 입력 (기본값: 파일명 기반 자동 제안)
- Import 실행 → 완료 시 `Assets → Data Sources → Datasets`로 이동

> 이 단계에서는 “기존 Dataset에 추가” 같은 기능을 **노출하지 않는다**.

**파일 타입 처리 방식**
- 사용자는 CSV/Parquet를 선택하지 않는다.
- 파일 선택 시 확장자/스니핑으로 자동 감지한다.
- 필요하면 모달 상단에 작은 배지로만 표시한다. (예: “CSV detected”)

**B) Connect folder (Folder Source) (Recommended) (NEW)**
- 폴더 선택(로컬 디렉토리 경로)
- Source 이름(표시명) 입력
- 옵션(선택): 파일 타입 필터(csv/parquet/both), 패턴(예: `*.csv`)
- 연결 완료 → `Assets → Data Sources → Sources`로 이동 (Folder Sources 섹션)

#### 전환 전략 (MVP): 기존 CSV/Parquet 모달을 최대한 재사용

UI는 “Import file” 1개로 통합하되, 내부 구현은 점진적으로 바꾼다.

- **Step 1 (최소 변경)**
  - “Import file” 버튼 → 파일 선택
  - 확장자 기반으로 기존 `ImportCSVModal` / `ImportParquetModal` 중 하나를 열어 재사용
  - 이때 모달에서 “add existing table” 같은 고급 옵션은 숨기거나 제거 (본 문서 목표에 맞춤)

- **Step 2 (정리)**
  - `ImportFileModal`(통합)로 합치고 내부에서 타입 감지/분기
  - UI/로직 중복 제거

---

### 6.2 Folder Source 상세 (탐색/처리)

Folder Source 카드 클릭 → Folder Source 상세(뷰/모달/드로어 중 UX 선택)

폴더 내 파일 리스트:
- 파일명 / 확장자 / 수정시간 / 크기 / (옵션) 미리보기
- 검색/필터: csv/parquet, 패턴, 최신순/이름순

파일 단위 액션:
- **Create Dataset** (기본 CTA)
  - 파일 1개를 선택하여 Dataset 생성
  - Dataset 이름 제안: 파일명 기반 자동 추천
- **Add to existing Dataset** (보조 CTA, Folder에서만 노출)
  - 사용자 의도: “폴더 안의 특정 파일을 기존 데이터에 합치기”
  - MVP에서는 UX를 단순하게 유지하기 위해:
    - 초기에는 “Add to existing Dataset”을 **Advanced로 접어두거나**, “2차 Phase”로 미룰 수 있음
  - (후속) 필요 시 append/merge 같은 세부 동작은 Folder 화면에서만 제공

폴더 단위 액션:
- **Rescan** (MVP)
  - 폴더의 최신 파일 목록 다시 읽기

---

## 7. 데이터/시스템 설계 (초안)

### 7.1 Folder Source 메타데이터 (프로젝트 스코프)

Folder Source는 프로젝트 격리(`project_id`)를 유지해야 한다.

최소 필드:
- `id` (uuid)
- `project_id`
- `name`
- `path` (로컬 디렉토리 경로)
- `allowed_types`: `csv | parquet | both`
- `pattern` (optional)
- `created_at`, `updated_at`

### 7.2 Folder 파일 목록 (런타임)

폴더 스캔 결과는 “파일 시스템 상태”이므로, 기본은 **동적 조회**로 한다.

파일 아이템 최소 필드:
- `path` (전체 경로)
- `name`
- `ext` / `type`
- `size_bytes`
- `modified_at`

### 7.3 Dataset 생성(Import) 처리

- “Create Dataset”은 기존의 file import 로직(예: CSV → `read_csv`, Parquet → `read_parquet`)을 재사용 가능하다.
- 생성 결과는 “Dataset(로컬 DuckDB 테이블/뷰)”로 나타나며, `Assets → Data Sources → Datasets`에서 관리한다.

---

## 8. API/기능 범위 (초안)

> 실제 라우팅/스키마는 구현 시점에 기존 API 구조(`source`, `asset`)와 맞춘다.

Folder Source:
- `POST /api/v1/source/folders` : 폴더 Source 생성
- `GET /api/v1/source/folders` : 폴더 Source 목록
- `DELETE /api/v1/source/folders/{id}` : 폴더 Source 삭제

Folder 파일 목록:
- `GET /api/v1/source/folders/{id}/files` : 폴더 스캔 결과(필터/정렬 지원)

Folder에서 Import:
- `POST /api/v1/source/folders/{id}/import`
  - 입력: `file_path`, `dataset_name`, (optional) `target_dataset_id`
  - 동작:
    - `target_dataset_id` 없음 → Create Dataset
    - `target_dataset_id` 있음 → Add to existing Dataset (후속/Advanced)

---

## 9. 자동 감지(후속) 방향

Folder Source는 DB Source처럼 “상태가 바뀔 수 있는 원천”이므로, 트리거 기반 자동 감지가 자연스럽다.

단계적 접근:

### Phase A (MVP)
- 수동 `Rescan` 버튼
- 스캔 결과만 보여주고 사용자가 Import를 선택

### Phase B (자동 스캔)
- 트리거 예시:
  - 앱 실행 시 / 프로젝트 열 때
  - 일정 주기(예: 60초~5분)
  - `Connect Data` 모달을 닫을 때 / Assets 화면 진입 시
- “새 파일 발견” UX:
  - 배너: “New files detected in {folder}”
  - 액션: “Review” → 해당 Folder Source 상세로 이동

### Phase C (Watcher 기반)
- OS watcher(가능하면)로 실시간 감지
- 감지 이벤트를 기준으로 “변경분만” 업데이트

---

## 10. 구현 우선순위 (제안)

- **P1**
  - 단건 파일 Import UX 단순화(파일 레벨에서 merge/append 노출 제거)
  - Folder Source 생성/목록/삭제
  - Folder Source 상세에서 파일 목록 + Create Dataset
- **P2**
  - Folder Source 상세에서 “Add to existing Dataset”(Advanced)
    - 유저 결정은 2개만 남긴다:
      - (1) Target Dataset 선택
      - (2) Mode 선택: Append(기본) / Replace(옵션)
    - Append 검증:
      - 컬럼이 정확히 동일해야 함(이름/순서). 불일치 시 에러 + Replace 유도.
    - Replace 동작:
      - Target Dataset의 테이블을 덮어쓴다(테이블명 유지).
      - UI에서는 “기존 Dataset을 업데이트”로 보이게 한다(중복 생성 방지).
    - 구현 UI(권장):
      - Folder file row 액션: [Create Dataset] [Add to existing]
      - Add to existing 클릭 시 작은 모달/패널:
        - Dataset 검색/선택
        - Append / Replace 선택
        - 실행 버튼
  - 폴더 스캔 필터/정렬/검색 강화
- **P3**
  - P3-1 (가벼운 버전)만 진행 (오버스펙 방지)
    - 트리거: **Assets → Data Sources → Sources 서브탭 진입 시**
    - 동작:
      - Folder Source별로 폴더를 스캔하고(현재 파일 목록)
      - 직전 스캔 스냅샷과 비교하여 delta 계산
      - UI에 “New files: N” 배지로 표시 + Review로 상세 진입
    - 저장해야 하는 최소 상태(프로젝트 스코프):
      - `last_scanned_at`
      - `last_scan_snapshot` (파일 목록: path + modified_at + size 정도)
    - 범위에서 제외:
      - 주기 스캔 스케줄러
      - OS watcher 기반 실시간 감지
      - 자동 import/자동 append 같은 자동화

---

## 11. 오픈 질문

1. Folder Source 상세 UI 형태: **새 페이지 / 모달 / 우측 패널(드로어)** 중 어떤 것이 가장 자연스러운가?
2. 폴더 내 파일 표시 범위: **csv/parquet만 표시** vs **전체 표시 후 필터** 중 어떤 것이 더 사용자 친화적인가?

