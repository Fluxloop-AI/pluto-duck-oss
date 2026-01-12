# Pluto Duck 하이브리드 아키텍처: 로컬 실행 + 서버 협업 (Control Plane)

**상태:** 채택됨 (Adopted)
**날짜:** 2026-01-12
**맥락:** "MotherDuck 스타일의 클라우드 실행" 모델에서 **"로컬 우선 + 서버 협업"** 모델로 피벗함.

## 1. 핵심 컨셉 (Core Concept)

철학은 **"로컬의 성능/프라이버시(DuckDB)는 유지하되, 서버는 협업(Control Plane)만 담당한다"**는 것입니다.

- **User**: 데스크톱 앱(macOS/Windows)을 설치하여 모든 데이터 처리를 **로컬**에서 수행합니다.
- **Server**: 인증(Auth), 공유, 스케줄 정책, 실행 이력만 관리합니다. **데이터를 직접 처리하지 않습니다.**
- **가치**: 로컬 사용자에겐 "설정이 필요 없는 분석 환경", 유료 사용자에겐 "팀 협업 기능"을 제공합니다.

## 2. 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    PlutoDuck 웹 서버                     │
│               (Control Plane Only)                      │
├─────────────────────────────────────────────────────────┤
│  Postgres                                               │
│  ├── Auth / Workspace / Team                            │
│  ├── Pipeline Registry (YAML/SQL 정의)                  │
│  ├── Run History / Logs                                 │
│  ├── Schedules (정책만 저장)                             │
│  ├── Comments / Versions                                │
│  └── Audit Logs                                         │
└─────────────────────────────────────────────────────────┘
                           ↕ 동기화 (HTTP/REST)
┌─────────────────────────────────────────────────────────┐
│                 로컬 데스크톱 (Tauri)                    │
│               (Data Plane - 실행 담당)                   │
├─────────────────────────────────────────────────────────┤
│  DuckDB                                                 │
│  ├── 데이터 소스 연결                                    │
│  ├── 쿼리 실행                                          │
│  ├── 파이프라인 실행 (duckpipe)                          │
│  └── 결과 생성                                          │
│                                                         │
│  동기화 매니저 (Sync Manager)                            │
│  ├── Push: 파이프라인 정의 ↔ 서버                        │
│  ├── Push: 실행 로그/상태 → 서버                         │
│  └── Push: 리포트 스냅샷 → 서버 (선택 사항)               │
└─────────────────────────────────────────────────────────┘
```

## 3. 협업 모델

**협업의 단위:** `데이터(Data)`가 아니라 **`산출물(Artifacts)`**입니다.

| 산출물 | 서버 저장 여부 | 동기화 방향 | 비고 |
|--------|----------------|-------------|------|
| 파이프라인 정의 (YAML/SQL) | ✅ | 양방향 | 분석의 "소스 코드" |
| 실행 로그/상태 | ✅ | 로컬 → 서버 | 감사(Audit) 및 이력용 |
| 리포트 (HTML/MD) | ✅ | 로컬 → 서버 | 최종 소비되는 결과물 |
| 결과 스냅샷 (Parquet) | 선택적 | 로컬 → 서버 | 작거나 요약된 결과만 공유 |
| 코멘트 | ✅ | 서버 전용 | 실행 결과나 파이프라인에 댓글 |
| **원본 데이터 / 테이블** | ❌ | 로컬 전용 | 로컬 DuckDB에만 존재 (보안) |

## 4. 스케줄링 전략 (옵션 C)

- **Server**: 스케줄 정책을 정의합니다 (예: "매일 오전 9시 실행").
- **Local App**: 서버를 폴링하거나 푸시를 받아 **로컬에서 실행**합니다.
- **제약사항**: 앱이 켜져 있어야 합니다 (포그라운드 또는 트레이 백그라운드).
- **대안**: 앱이 꺼져 있었을 경우, 다음 실행 시 수행하거나 알림을 보냅니다.

## 5. 기술 스택

### Local (Desktop)
- **Frontend**: Next.js (Static Export)
- **Backend**: Python (FastAPI + DuckDB) 패키징 (PyInstaller)
- **Shell**: Tauri (v2)
- **OS Support**: macOS (Intel/Silicon), Windows (x64)

### Server (Web)
- **Hosting**: Railway (FastAPI 백엔드 배포)
- **Auth/DB**: Supabase (Auth + Postgres)
- **Storage**: Supabase Storage (기본) 또는 S3 호환 스토리지 (옵션)

## 6. 구현 로드맵

이 로드맵은 **\"로컬의 완성도\"를 먼저 올린 뒤**, 서버(Control Plane)를 점진적으로 붙이는 방식으로 설계합니다.

### Phase 0: MVP 범위 고정 (1~3일)
- [ ] **협업 범위(SKU) 확정**: 기본은 **\"정의 + 리포트/로그\" 공유**로 고정하고, **Parquet 스냅샷 공유는 옵션(상위 플랜)**으로 분리합니다.
- [ ] **동기화 규칙 확정**: \"서버 = Source of Truth\" / 로컬 수정은 서버에 **버전 생성** / 로컬은 pull 기반.
- [ ] **스케줄링 MVP 확정**: 초기에는 **Polling**(예: 30~60초) + 조건부 요청(ETag/If-Modified-Since)로 시작합니다.
- [ ] **오프라인 정책 확정**: 앱이 꺼져 있으면 run은 **Skipped**로 기록하고, 다음 실행 시 catch-up(옵션) + 알림을 제공합니다.
- [ ] **산출물 포맷 정의**: Pipeline 정의(JSON/YAML), Report(HTML/MD), Logs(JSONL), Snapshot(Parquet) 각각의 스키마/메타데이터를 고정합니다.

**완료 조건(DoD)**:
- 협업 범위/동기화/스케줄링/오프라인 정책이 1페이지로 정리되어 있고, 팀 내에서 합의됨
- 산출물 포맷(필수 필드/파일명/경로)이 고정됨

### Phase 1: 로컬 기반 강화 (1~2주)
**목표:** macOS/Windows에서 \"로컬 실행\"이 신뢰할 수 있게 동작하고, 추후 서버 연동을 위한 관측/패키징 기반을 완성합니다.

- [ ] **Windows 패키징**: Windows에서 Python 백엔드(PyInstaller)와 Tauri 번들링을 검증하고 자동화 스크립트를 추가합니다.
  - 산출물: Windows 빌드 스크립트(`build-backend.bat` 또는 `build-backend.ps1`), 재현 가능한 빌드 가이드
- [ ] **로컬 실행 관측성**: 실행/오류/성능 로그 구조화(JSON) 및 Run ID/Trace ID를 도입합니다.
  - 산출물: `run_id`, `project_id`, `asset_id`가 포함된 표준 로그 포맷
- [ ] **리포트 생성 표준화**: 리포트 저장 경로/파일명 규칙 및 메타데이터(JSON)를 고정합니다.
  - 산출물: `{data_dir}/reports/{run_id}/report.html` + `metadata.json`
- [ ] **시크릿 저장 표준화**: 커넥션 스트링/토큰은 **OS 키체인**에 저장하고, 앱 데이터 디렉토리에는 저장하지 않습니다.
  - 산출물: Keychain/Credential Vault 어댑터(추상화) + 마이그레이션 정책
- [ ] **duckpipe 안정성**: 실패 재시도, 중단/재개(가능한 범위), 에러 메시지/원인(소스/권한/네트워크)을 구분해 표준화합니다.

**완료 조건(DoD)**:
- macOS/Windows에서 동일한 프로젝트를 열고, 동일한 분석을 실행해 결과/리포트가 생성됨
- `run_id` 기반 로그/리포트/메타데이터가 항상 생성되고, 실패 시에도 원인 분류가 가능함
- 시크릿이 파일로 남지 않음을 확인(키체인/자격 증명 저장소만 사용)

### Phase 2: 컨트롤 플레인 서버 구축 (2~4주)
**목표:** 서버가 “협업을 위한 메타데이터”만 관리하도록 최소 기능부터 구축합니다.

- [ ] **Auth + Workspace/RBAC**: 사용자/워크스페이스/멤버십(Owner/Editor/Viewer)을 구현합니다.
  - 산출물: JWT 기반 인증(또는 Supabase), 권한 체크 미들웨어
- [ ] **핵심 스키마(MVP)**: 다음 엔티티를 최소 필드로 시작합니다.
  - Workspaces, Members, Pipelines(버전), Runs(상태/로그 링크), Comments, Schedules
- [ ] **Artifacts 저장소**: 리포트/스냅샷 업로드를 위한 Supabase Storage 연결.
  - 산출물: 업로드용 signed URL 발급, 메타데이터 테이블(artifact index)
- [ ] **API(MVP)**:
  - `POST /pipelines` (정의 업로드/버전 생성)
  - `GET /pipelines` / `GET /pipelines/{id}` (정의/버전 조회)
  - `POST /runs` (run 생성 + 상태 전이)
  - `POST /runs/{id}/logs` (로그 업로드 or 링크 등록)
  - `POST /runs/{id}/artifacts` (리포트 업로드 완료 콜백)
  - `GET /schedules?agent_id=...` (폴링용: due schedule 조회)
  - `POST /schedules/{id}/ack` (실행 시작/완료/스킵 보고)
- [ ] **감사 로그(Audit)**: "누가 무엇을 공유/수정/실행했는지"를 남깁니다(유료 핵심 가치).

**완료 조건(DoD)**:
- 워크스페이스/RBAC가 적용된 상태로 파이프라인 정의/버전/런 이력이 저장되고 조회됨
- 아티팩트 업로드가 signed URL로 동작하고, 서버에는 메타데이터만 남음
- 스케줄 due 조회(폴링)와 ack가 동작하며, 감사 로그가 쌓임

### Phase 3: 로컬-서버 연결 (2~4주)
**목표:** 로컬 앱이 서버에 로그인하고, 산출물을 업로드/다운로드하며, 스케줄을 폴링해 실행합니다.

- [ ] **로그인 플로우**: Desktop에서 “Pluto Cloud로 로그인” (브라우저 OAuth/딥링크) → 토큰 저장(키체인).
  - 산출물: 토큰 갱신/만료 처리, 로그아웃/키체인 삭제
- [ ] **Syncer(백그라운드 동기화)**: 주기적으로 pull/push를 수행하는 로컬 동기화 모듈을 구현합니다.
  - pull: pipeline 정의/권한/스케줄
  - push: run 상태/로그/리포트/스냅샷(옵션)
- [ ] **스케줄 실행기(Local Runner)**:
  - due schedule 폴링 → 실행 큐잉 → 로컬 실행 → 결과 업로드
  - 앱 오프라인이면 서버에 skipped 보고(또는 next-start catch-up)
- [ ] **충돌/버전 UX**: 동일 파이프라인을 로컬에서 수정했다면 서버에 “새 버전 생성” 또는 “포크/PR” UX로 해결합니다.

**완료 조건(DoD)**:
- Desktop 로그인 → 워크스페이스 선택 → 파이프라인 pull → 로컬 실행 → run/log/report(옵션 snapshot) push가 끝-투-끝으로 동작
- 앱이 꺼져 있는 동안 due 스케줄이 발생하면, 다음 실행 시 catch-up 또는 skipped 보고가 일관되게 동작

### Phase 4: 유료화 기능 확장 (지속)
- [ ] **코멘트/멘션/알림**: 리포트/런에 코멘트, 멘션, 이메일/앱 알림.
- [ ] **버전 비교/롤백**: 파이프라인 버전 diff, 특정 버전으로 실행 고정.
- [ ] **정책 기반 실행 제어**: 팀 단위 실행 권한, 승인 워크플로(HITL), 실행 제한(시간/리소스).
- [ ] **엔터프라이즈 옵션**: SSO/SAML, 온프렘 설치, 보존 기간/감사 정책.

## 7. 주요 의사결정 (Key Decisions)

### 7.1 동기화 정책 (Sync Policy)
- **충돌 해결**: 서버가 **Source of Truth**입니다. 로컬 수정 사항은 서버에 새로운 버전으로 기록됩니다(Git-like).
- **스케줄링 통신**: MVP는 **로컬 앱의 폴링(Polling)** 방식으로 구현합니다. (복잡한 푸시 서버 불필요)
- **앱 오프라인 시**: "실행 실패(Skipped)"로 기록하고, 다음 앱 실행 시 **Catch-up 실행** 또는 알림을 제공합니다.

### 7.2 보안 및 권한 (Security)
- **시크릿 관리**: DB 접속 정보 등 민감 데이터는 서버에 저장하지 않고 **로컬 OS 키체인(Keychain/Credential Vault)**에만 저장합니다.
- **공유 권한**: 워크스페이스 단위 RBAC(Owner/Editor/Viewer)를 적용하여 산출물 접근을 제어합니다.

## 8. 소스(코드) 아키텍처 (Source Architecture)

기존 로컬 앱의 레이어 구조(Next.js → FastAPI → Services → duckpipe → DuckDB)는 유지하면서, 서버 연동을 위해 **\"Sync/Control Plane\" 컴포넌트만 추가**합니다.

### 8.1 로컬(Desktop) 구성요소
- **UI (Next.js Static Export)**: Chat/Boards/Assets 등 사용자 인터랙션.
- **Local API (FastAPI)**: 로컬 실행 엔진과 UI 사이의 API.
- **Service Layer**: Source/Asset/Boards/WorkZone 서비스가 duckpipe와 DuckDB를 조합합니다.
- **duckpipe**: 파이프라인 컴파일/실행/라인리지.
- **DuckDB(Storage)**: 데이터/캐시/런타임 상태 저장.
- **Syncer (NEW)**: 서버와의 동기화(정의/스케줄 pull, run/log/report push).
- **Secret Store (NEW)**: OS 키체인 기반 시크릿 저장(토큰/커넥션).

**현재 레포 디렉토리 매핑(참고)**:
- `frontend/pluto_duck_frontend/`: Next.js UI (Static Export)
- `backend/pluto_duck_backend/`: 로컬 FastAPI + 서비스 레이어 + 에이전트
- `backend/duckpipe/`: 파이프라인 라이브러리
- `tauri-shell/`: Tauri 앱/번들링 설정(`src-tauri/tauri.conf.json`)
- `scripts/`: 빌드 스크립트(`build-backend.sh` 등)

### 8.2 서버(Control Plane) 구성요소
- **Auth**: Supabase Auth (OAuth) + JWT 검증.
- **Workspace/RBAC**: 멤버십/권한 체크.
- **Pipeline Registry**: 파이프라인 정의/버전/메타데이터 저장.
- **Run Ledger**: 실행 상태 전이, 로그 인덱스, 아티팩트 인덱스.
- **Scheduling Policy**: 스케줄 정의/상태(due) 관리(실행은 로컬).
- **Artifact Store**: Supabase Storage(기본) + signed URL 기반 업로드/다운로드. (필요 시 S3 호환으로 교체 가능)

**권장 디렉토리 구조(신규 패키지/배포 단위)**:

- 목표는 `backend/pluto_duck_backend/`(로컬 앱용 FastAPI)와 **서버(Control Plane)**를 **의존성/설정/배포 단위까지 분리**하는 것입니다.
- 로컬은 DuckDB/duckpipe/에이전트 등이 포함되지만, 서버는 **Supabase(Postgres/Auth/Storage)** 중심이므로 런타임/설정이 달라집니다.

```
backend/
  pluto_duck_backend/                 # Local Desktop Backend (existing)
    app/
    agent/
    ...

  pluto_duck_control_plane/           # NEW: Control Plane Server (deployable)
    pyproject.toml                    # 별도 배포/의존성 분리 (Railway에서 이 디렉토리만 배포 가능)
    README.md                         # 실행/배포 가이드
    control_plane/                    # (권장) 폴더=파이썬 패키지명으로 단순화
      __init__.py
      main.py                         # FastAPI app entrypoint (server)
      api/
        __init__.py
        router.py
        v1/
          __init__.py
          auth/                       # Supabase JWT 검증 + 사용자/워크스페이스 바인딩
          workspaces/                 # workspace + membership + RBAC
          pipelines/                  # registry + versions
          runs/                       # run ledger + events + log pointers
          schedules/                  # due 조회 + ack
          artifacts/                  # signed URL + metadata registration
      core/
        __init__.py
        config.py                     # env config (SUPABASE_URL/KEY, JWT, etc.)
        security.py                   # RBAC helpers, auth deps
      db/
        __init__.py
        models.py                     # SQLAlchemy/SQLModel (Supabase Postgres)
        # migrations/                 # (Optional) Supabase CLI를 쓴다면 제거, 코드 기반 관리 시 Alembic 사용
      storage/
        __init__.py
        storage_client.py             # Supabase Storage Wrapper (signed URL)
      audit/
        __init__.py
        audit_log.py                  # audit event emitter + schema
      tests/
        ...
```

**참고(파이썬 패키지 구조 대안)**:
- `pluto_duck_control_plane/pluto_duck_control_plane`처럼 중첩되는 구조는 배포/패키징 관점에선 흔한 패턴입니다.
- 다만 이 문서에서는 \"헷갈림 최소화\"를 위해 **폴더=패키지명**(예: `control_plane/`) 구조를 기본으로 제안합니다.

**대안(빠른 시작)**:
- 초기에는 `backend/pluto_duck_backend/app/api/v1/` 아래에 `cloud/` 라우터를 추가해도 되지만,
  - 장기적으로는 로컬 앱과 서버의 릴리즈/의존성/설정이 달라져서 분리 비용이 커집니다.
  - 따라서 MVP부터 위처럼 **`pluto_duck_control_plane` 분리**를 권장합니다.

### 8.3 경계(Contract)와 책임
- **서버는 절대 데이터 처리/쿼리 실행을 하지 않는다**: 서버는 메타데이터와 파일 인덱스만 보유합니다.
- **로컬은 실행의 단일 책임자**: 실행 실패/성공 원인은 로컬 로그/환경 정보로 추적 가능해야 합니다.

## 9. 구현 전략 (Implementation Strategy)

### 9.1 MVP 우선순위 (최소-가치 경로)
1) **서버에 \"파이프라인 정의 + 실행 이력\"만 올라가도** 협업/관리 가치가 즉시 생깁니다.  
2) 리포트는 **HTML/MD 업로드**로 시작하고, 결과 스냅샷(Parquet)은 나중에 붙입니다.  
3) 스케줄은 **Polling**으로 시작하고, Push는 \"추가 옵션\"으로 둡니다.

### 9.2 데이터 모델/버전 모델
- 파이프라인 정의는 **버전 증가(immutable)**를 기본으로 하고, 최신 버전을 “현재 버전”으로 표시합니다.
- 로컬에서 수정은 “서버에 새 버전 생성”으로 수렴시켜 **충돌 해결을 단순화**합니다.

### 9.3 동기화 프로토콜 가이드
- **Idempotency**: `run_id`, `artifact_id`는 클라이언트(로컬)가 UUID v7 등으로 생성합니다. 서버는 이미 존재하는 ID 요청이 오면 `200 OK` (멱등성 보장)를 반환합니다.
- **상태 전이**: `pending → running → success|failed|skipped`를 서버가 기록하고, 로컬은 이벤트를 보고합니다.
- **업로드 방식**: 아티팩트는 **Signed URL**로 직접 업로드하고, 서버에는 메타데이터(경로, 크기, 타입)만 등록합니다.

### 9.4 운영/디버깅 전략
- 로컬 실행 실패는 **환경 문제(권한/드라이버/네트워크)** 가능성이 높으므로,
  - 표준 로그 + 환경 스냅샷(OS/버전/커넥터 상태)을 run에 첨부할 수 있어야 합니다.
- 서버는 비용/복잡도를 낮추기 위해 **텍스트/정적 파일 중심**으로 유지합니다.
