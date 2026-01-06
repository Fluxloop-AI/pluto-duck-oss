# Pluto Duck Backend: Deep Agents 구조 이식 설계안

작성일: 2026-01-05  
대상 코드: `backend/pluto_duck_backend/agent/core`  
참조: `ref/deepagents-master` (MIT License)

---

## 1) 목적 (왜 하는가)

현재 Pluto Duck의 에이전트는 `planner → schema → sql → verifier → finalize`로 고정된 LangGraph 노드 체인을 갖고 있습니다. 이 구조는 빠르게 “NL→SQL”을 만들기엔 단순하지만, **긴 작업(수십 번의 tool calling), 중간 산출물 관리, 반복적인 분석 워크플로(스킬 재사용), 컨텍스트 폭주 관리**에 취약합니다.

deepagents(“Deep Agents”)가 제공하는 핵심 원칙은 다음 3가지입니다.

- **Planning (Todo 기반 계획/진척 관리)**
- **Filesystem 활용(중간 산출물·긴 결과를 파일로 offload)**
- **Sub-agent delegation(복잡한 작업을 격리해서 맡기고 결과만 합성)**

이 문서는 **기존 노드 체인을 제거**하고, deepagents 스타일(= `create_agent` + middleware 스택)로 `agent/core`를 재구성하는 방식을 제안합니다.

---

## 2) 목표 / 비목표

### 목표
- **기존 `agent/core/graph.py`의 노드 기반 워크플로를 제거**하고 deepagents harness 기반 그래프로 전환
- Pluto Duck Backend의 **SSE 이벤트 스키마(`AgentEvent`)를 유지**(프론트/CLI 호환)
- 데이터 분석 작업이 원활해지도록:
  - 분석 중간물(SQL, 결과 요약, 스키마 스냅샷, 메모 등)을 파일로 관리
  - 반복 워크플로를 **Skills**로 등록/호출 가능하게 설계
  - 복잡한 하위 작업은 **subagent(task)**로 위임 가능하게 설계

### 비목표(이번 전환에서 하지 않음)
- 프론트엔드 이벤트 해석 로직 변경(가능한 한 backend에서 호환 유지)
- “완전한 HITL(승인/거부 UI)” 도입 (단, **승인/거부 로직 자체는 필수**이며 UI는 차후 확장)
- 임의의 OS shell 실행을 “무제한” 허용 (보안/안정성 때문에 제한된 범위로만 제공)

### 확정된 결정(Confirmed Decisions)
- **실행 경로 우선순위**: DuckDB/DBT/ingest 같은 도메인 작업은 **Pluto Duck tool 기반**으로 간다.
- **`execute`(shell)**: backend 모드에서는 **미허용(비활성)**. (허용 커맨드 allowlist는 “없음”으로 확정)
- **skills 스크립트 실행**: backend 모드에서는 **미허용**. (skills는 “프롬프트/SQL 템플릿/가이드”로만 활용)
- **HITL 승인/재개 모델**: 승인 대기 상태를 **DB에 저장**하고, 승인/거부/편집 결정을 받아 **중단/재개(resume)** 를 지원한다.
- **HITL 승인 대상 tool 범위**: `write_file`, `edit_file`, `task`, `dbt_*`는 **모두 승인 대상**으로 한다. (`execute`는 미허용이므로 대상에서 제외)
- **FS workspace 키**: 작업공간 디렉토리는 **conversation_id 기준**으로 만든다.
- **reasoning 이벤트 노출**: **최대(가능한 한 상세/고빈도로 스트리밍)**로 한다.
- **deepagents 도입 방식**: `ref/deepagents-master`를 **vendoring** 방식으로 포함한다(향후 tracing/instrumentation 목적).

---

## 3) 현재 구조 요약(현행)

### 런타임 구성
- 오케스트레이션: `agent/core/orchestrator.py` (`AgentRunManager`)
- 그래프: `agent/core/graph.py` (`StateGraph(AgentState)` + 노드 체인)
- 상태: `agent/core/state.py` (`AgentState` dataclass)
- 이벤트: `agent/core/events.py` (`AgentEvent`, `EventType`, `EventSubType`)
- API:
  - `/api/v1/agent/run` → run 시작
  - `/api/v1/agent/{run_id}/events` → SSE 스트림

### 기존 이벤트 스키마(유지해야 하는 계약)
`docs/ARCHITECTURE.md`에 정의된 이벤트 스키마(요약):
- `reasoning.*`: 의사결정/상태 업데이트
- `tool.*`: planner/schema/sql/verifier 스냅샷
- `message.final`: 최종 답변
- `run.end|run.error`: 완료/에러

---

## 4) deepagents 구조(목표 상태)

### deepagents 핵심 구성요소
`ref/deepagents-master/libs/deepagents/deepagents/graph.py` 기준:
- `create_deep_agent(...)` → 내부적으로 `langchain.agents.create_agent(...)`로 LangGraph runnable을 만든 뒤,
  middleware로 아래를 주입:
  - **TodoListMiddleware**: `write_todos`, `read_todos`
  - **FilesystemMiddleware**: `ls/read_file/write_file/edit_file/glob/grep/(execute)`
  - **SubAgentMiddleware**: `task` (subagent spawner)
  - Summarization / PatchToolCalls / (옵션) HITL

### Pluto Duck에 적용 시 “중요한 사실(호환성)”
현재 Pluto Duck은 `pyproject.toml`에 `langchain-core`만 있고, deepagents는 **`langchain` 패키지(agents + middleware)**를 사용합니다.

따라서 “deepagents 구조를 그대로” 적용하려면 아래 중 하나가 필요합니다.

1) **권장: `langchain`(및 필요한 부가 패키지)을 의존성으로 추가**하고 deepagents를 **vendoring**으로 도입  
2) (대안) `langchain` 없이 deepagents 개념만 직접 구현(= “그대로”는 아님)

또한 Pluto Duck의 LLM 추상화는 `BaseLLMProvider.ainvoke(prompt:str)->str` 형태인데, deepagents의 `create_agent`는 통상 `BaseChatModel` 기반을 기대합니다.  
→ **LLM wrapper(PlutoDuckChatModel)**를 두어 기존 provider를 LangChain ChatModel 인터페이스로 래핑하는 것이 필요합니다.

---

## 5) 제안 아키텍처(Backend 관점)

### 5.1 전체 흐름
1) `AgentRunManager`가 대화 이력(ChatRepository)을 읽어 LangChain message로 변환
2) deepagents 그래프(`deep_agent`)에 `{"messages":[...]} + runtime config`로 실행
3) 실행 중 발생하는 **모델 스트림/툴 호출/툴 결과/최종 응답**을 Pluto Duck의 `AgentEvent`로 매핑해서 SSE로 송출
4) 최종 답변은 기존처럼 conversation에 append + run completed 처리

### 5.2 모듈/디렉토리 제안
`backend/pluto_duck_backend/agent/core` 내부를 다음처럼 재편(예시):

- `agent/core/`
  - `orchestrator.py` (유지: API/DB 연동, SSE 큐, run lifecycle)
  - `events.py` (유지: SSE 계약)
  - `deep/`
    - `agent.py` : deep agent 생성(= create_agent + middleware stack)
    - `model.py` : `PlutoDuckChatModel` (기존 `BaseLLMProvider` 래핑)
    - `backend.py` : filesystem backend(작업공간 루팅/보안)
    - `event_mapper.py` : LangChain/LangGraph 이벤트 → `AgentEvent` 매핑
    - `tools/` : Pluto Duck 도메인 tool들(쿼리/스키마/ingest/dbt/actions 등)
    - `skills/` : (선택) SKILL.md loader + middleware

기존 `nodes/`, `graph.py`, `state.py`는 전환 후 제거 또는 deprecated 처리합니다(최종 결정은 구현 단계에서).

---

## 6) Filesystem 설계(중요: 보안/안정성)

### 6.1 목표
deep agent가 파일을 활용할 때 “무제한 디스크 접근”이 아니라,
**Pluto Duck의 데이터 루트(`~/.pluto-duck/`) 하위에 격리된 작업공간**만 접근하도록 제한합니다.

### 6.2 작업공간 루트 제안
`docs/ARCHITECTURE.md`의 data layout을 따름:
- 기본 루트: `~/.pluto-duck/`
- 제안 작업공간: `~/.pluto-duck/agent_workspaces/<conversation_id>/`

### 6.3 virtual path 규칙(권장)
deepagents filesystem middleware는 “/로 시작하는 경로”를 가정합니다.  
backend에서 다음 virtual mount를 제공하는 것을 권장합니다.

- `/workspace/` → `~/.pluto-duck/agent_workspaces/<conversation_id>/`
- `/artifacts/` → `~/.pluto-duck/artifacts/` (읽기 위주)
- `/memories/` → 장기 기억(옵션; 초기에는 비활성)

또한 `..`, `~` traversal은 항상 차단합니다.

### 6.4 execute(쉘) 도구 기본 정책
- 기본: **미허용(비활성)**
- 목적/배경:
  - shell 기반 실행은 플랫폼/패키징/보안 변수가 크고, backend API에서 위험도가 높음
  - 따라서 CSV/로컬 파일 처리는 shell이 아니라 **Filesystem tools + DuckDB read_* + Pluto Duck tool**로 해결
- 결과:
  - allowlist는 “없음”(전부 미허용)
  - HITL 승인 플로우도 `execute`에는 적용하지 않음(호출 자체를 막음)

- DuckDB 실행은 **shell에서 `duckdb` CLI로 돌리는 대신** Pluto Duck이 이미 갖고 있는 “안전한 실행 경로”를 tool로 노출:
  - DuckDB 쿼리 실행: `QueryExecutionService/Manager` 기반 tool
  - dbt 실행: transformation service 기반 tool
  - ingestion: ingestion service 기반 tool

참고: HITL “UI”는 차후 확장이지만, backend 레벨에서는 승인/거부/편집 로직(상태 저장 + 재개)이 필요합니다.

---

## 7) Tool/Skill 설계(데이터 분석 관점)

### 7.1 “deep agent”에서 tool이 해야 하는 일
노드 체인이 사라지기 때문에, 기존에 노드가 하던 작업을 **tool**로 제공해야 합니다.

권장 tool 그룹:
- **Schema/metadata**
  - `list_tables()`
  - `describe_table(table)`
  - `sample_rows(table, limit)`
- **Query execution**
  - `run_sql(sql) -> {run_id, result_table, status, error, preview}`
  - (선택) `fetch_result(run_id, limit)`
- **Projects/DBT**
  - `dbt_run(...)`, `dbt_compile(...)`, `dbt_ls(...)` 등
- **Ingestion**
  - `ingest_source(connector, config, target_table, overwrite)`
- **Boards/Artifacts**
  - `save_chart_spec(...)`, `save_report_md(...)` 등(파일로 저장 + 링크 반환)

이렇게 하면 “schema/sql/verifier” 노드 대신, agent가 필요할 때 tool을 호출하며 진행합니다.

### 7.2 Skills(재사용 가능한 워크플로)
deepagents-cli가 사용하는 Agent Skills 패턴(SKILL.md + YAML frontmatter)은 데이터 분석에도 유용합니다.

예: `skills/time-series-analysis/SKILL.md`
- when-to-use: 시계열 집계/결측 처리/윈도우 함수 템플릿
- step-by-step: “스키마 확인 → 집계 SQL 작성 → 검증 쿼리 → 결과 요약/시각화”
- 지원 파일: SQL 템플릿, 파이썬 스크립트(단, 실행은 기본 비활성)

**권장 로딩 순서**
- project skills(프로젝트에 포함된 skill)이 user skills(전역)보다 우선

**주의**
backend API 모드에서는 “skill이 스크립트를 실행”하는 패턴은 기본 비활성로 두고,
skill은 “프롬프트 텍스트/SQL 템플릿/가이드” 중심으로 설계하는 것을 권장합니다.

---

## 8) SSE 이벤트 매핑(호환 핵심)

노드 체인이 사라져도, 프론트/CLI는 기존 이벤트를 기대합니다.  
따라서 deep agent 실행 중 발생하는 “모델/툴” 이벤트를 아래 규칙으로 `AgentEvent`로 변환합니다.

### 8.1 이벤트 매핑 원칙
- **tool 호출**은 항상 `EventType.TOOL`로 내보낸다.
- deepagents의 `write_todos` 결과는 기존 `planner` 이벤트처럼 내보낸다.
- 스키마/SQL/검증은 “어떤 tool이든” 결과 payload를 기존 키로 정규화한다.
- 최종 응답은 `EventType.MESSAGE` + `subtype=FINAL`로 통일한다.

### 8.2 추천 매핑 테이블(초안)
| deep agent 관찰 이벤트 | Pluto Duck 이벤트 |
|---|---|
| `write_todos` tool result | `tool.end` + `{"tool":"planner","plan":[...]}` |
| `list_tables/describe_table/...` result | `tool.chunk` + `{"tool":"schema","preview":[...]}` |
| LLM이 SQL을 생성(텍스트에서 추출) 또는 `run_sql(sql=...)` 호출 직전 | `tool.chunk` + `{"tool":"sql","sql":"..."}` |
| `run_sql` result | `tool.end` + `{"tool":"verifier","result":{...}}` |
| 최종 assistant message | `message.final` + `{"text":"..."}` |
| 런 완료 | `run.end` |
| 런 에러 | `run.error` |

### 8.3 “reasoning” 이벤트 처리(선택)
기존에는 reasoning 노드가 “다음 단계 결정”을 내보냈습니다. deep agent에서는 중앙 컨트롤러 노드가 없으므로:
- (확정) **reasoning 이벤트는 “최대(가능한 한 상세/고빈도)”로 노출**한다.
  - **모델 출력 스트리밍**(가능한 provider에서는 토큰/청크 단위로 reasoning/message 이벤트를 즉시 emit)
  - **툴 호출 전후 진행상태**(예: “schema 조회 시작/완료”, “dbt 실행 대기”, “승인 대기 중” 등)
  - **HITL/재개 경계**(interrupt 발생/결정 반영/resume 시점)
  - **subagent 경계**(task spawn/return)
  - 주의: 저장소(DB)에 이벤트를 모두 적재할지, 스트림만 상세하고 저장은 요약할지는 비용 정책으로 별도 결정(아래 ‘다음 액션’ 참고)

---

## 9) 마이그레이션 단계(실행 계획)

### Phase 0 — 의존성/라이선스 정리
- **목표**: “deepagents를 backend 코드베이스 안에 포함 + LangChain/Graph 런타임 준비 + HITL 저장/재개를 위한 DB 스키마 준비”
- **작업**
  - **deepagents vendoring**
    - 권장 위치: `backend/deepagents/` (패키지명이 그대로 `deepagents`가 되도록)
    - 포함 범위: CLI(`deepagents-cli`)는 제외하고, core(`libs/deepagents/deepagents/**`) 위주로 포함
    - 라이선스 고지: vendored 디렉토리에 `LICENSE`(MIT) 포함 + 루트 `NOTICE`(또는 docs)에서 “vendored third-party” 명시
  - **의존성 추가(최소 세트)**
    - `langchain`(agents/middleware) 및 deepagents가 참조하는 최소 모듈을 추가
    - `langchain-core`/`langgraph`와 버전 정합성 유지(가능하면 같은 minor 라인으로 pin)
    - Anthropic 전용 미들웨어 등 “필수 아님”은 **코드에서 제거/비활성**하여 불필요한 의존성 확장을 피함
  - **DB 스키마/DDL 확장**
    - approvals 테이블 추가(예: `agent_tool_approvals`)
    - checkpointer 테이블 추가(예: `agent_checkpoints` / `agent_checkpoint_blobs`)
    - 적용 위치: `pluto_duck_backend/app/services/chat/repository.py`의 `DDL_STATEMENTS`에 포함(현재 DuckDB 기반)
  - **HITL 정책 확정**
    - 승인 대상: `write_file`, `edit_file`, `task`, `dbt_*` (확정)
    - `execute`/skills 스크립트는 미허용(확정)
    - approval decision: `approve|reject|edit` (edit는 args 수정)
- **산출물**
  - vendored deepagents 코드 + 라이선스 고지
  - `pyproject.toml` 의존성 업데이트(최소 세트)
  - approvals/checkpoint DDL 추가
- **완료 조건**
  - backend import 단계에서 vendored deepagents 모듈 로딩 가능
  - 로컬 실행 시 DDL이 자동 생성되고, approvals/checkpoint 테이블이 존재

### Phase 1 — deep agent 최소 골격 도입
- **목표**: “deep agent runnable 생성 + 기본 스트리밍 + HITL interrupt + resume 경로를 end-to-end로 연결”
- **작업**
  - **LLM wrapper**
    - `agent/core/deep/model.py`: 기존 `BaseLLMProvider`를 LangChain `BaseChatModel` 호환으로 래핑
    - (권장) 가능한 provider(OpenAI)에서 **스트리밍 지원**을 추가하여 reasoning “최대”를 뒷받침
  - **Filesystem backend (execute 미허용)**
    - `agent/core/deep/backend.py`: `/workspace/**` 기반 경로 검증, traversal 차단
    - `execute`는 노출하지 않거나 호출 시 “미허용” 오류 반환(정책 일치)
  - **Agent graph 생성**
    - `agent/core/deep/agent.py`: `create_agent`/vendored `create_deep_agent`로 runnable 생성
    - middleware 스택 구성:
      - TodoList + Filesystem + SubAgent
      - **커스텀 HITL middleware**(DB approval 생성 + interrupt + resume)
      - Summarization(필요 시) / PatchToolCalls(필요 시)
  - **이벤트 매퍼**
    - `agent/core/deep/event_mapper.py`: LangChain/LangGraph 스트림 이벤트를 `AgentEvent`로 변환
    - 최소 구현: tool start/end, approval_required, decision_applied, final message, run end/error
    - reasoning “최대” 구현: 모델/툴/승인 경계에서 chunk 이벤트를 적극 emit
  - **resume 제어면**
    - `AgentRunManager`에 `resume_run(run_id, approval_id, decision)` 같은 재개 API를 위한 내부 메서드 설계
- **산출물**
  - `agent/core/deep/*` 기본 골격
  - “승인 대기 → decision → resume → 완료”를 한 run에서 재현 가능한 최소 기능
- **완료 조건**
  - 승인 대상 tool 호출 시 run이 멈추고(“waiting_for_approval”), decision 후 이어서 완료
  - SSE 이벤트로 approval_id/decision/resume이 관찰됨

### Phase 2 — Pluto Duck tool 세트 이관
- **목표**: 노드 체인이 하던 일을 **도메인 tool**로 완전히 대체(에이전트가 tool-calling으로 분석 수행)
- **작업(권장 tool 목록)**
  - **Schema/metadata tools**
    - `list_tables`, `describe_table`, `sample_rows`
    - 구현은 DuckDB 메타테이블 + 기존 execution/service 레이어 재사용
  - **Query execution tool**
    - `run_sql(sql)` → `{run_id,status,result_table,error,preview}`
    - (선택) `fetch_result(run_id, limit)`
  - **DBT tools (모두 HITL 승인 대상)**
    - `dbt_ls`, `dbt_compile`, `dbt_run`, `dbt_test` 등
    - 결과/로그는 파일로 offload(`/workspace/logs/...`) 후 요약만 메시지로 반환
  - **Ingestion/tools**
    - `ingest_source(...)` 등(기존 ingestion 서비스 호출)
  - **(선택) Boards/Artifacts tools**
    - 리포트/차트 스펙 저장용 tool (`save_report_md`, `save_chart_spec`)
  - **Skills(스크립트 미허용)**
    - SKILL.md 로더/미들웨어는 “프롬프트 주입/가이드 제공”까지만(스크립트 실행 금지)
- **산출물**
  - `agent/core/deep/tools/**` 도메인 tool 세트
  - tool 결과의 “파일 offload 표준”(큰 출력은 파일 저장 + path 반환)
- **완료 조건**
  - 대표 분석 시나리오(스키마→SQL→쿼리→요약)가 노드 없이 tool-calling으로 동작
  - dbt/tool 호출 시 HITL 승인/재개가 일관되게 동작

### Phase 3 — orchestrator 교체
- **목표**: 기존 `agent/core/graph.py` 기반 경로를 제거하고, orchestrator가 deep agent runnable을 실행하도록 전환
- **작업**
  - `agent/core/orchestrator.py`
    - `build_agent_graph()`/노드 업데이트 파싱 로직을 제거
    - deep agent의 스트림(모델/툴/승인)을 event_mapper를 통해 `AgentEvent`로 변환
    - ChatRepository 저장:
      - assistant 최종 메시지 저장(기존 유지)
      - agent_events 저장(기존 유지, 단 reasoning “최대”의 저장 정책은 별도 cap 필요 가능)
  - API 라우터
    - `app/api/v1/agent/router.py`에 approvals 조회/decision 엔드포인트 추가
    - decision 제출 시 `AgentRunManager.resume_run(...)` 호출
  - deprecated 제거
    - 기존 `agent/core/nodes/**`, `agent/core/graph.py`, `agent/core/state.py`는 제거 또는 더미/호환 레이어로 축소(최종 결정)
- **산출물**
  - deep agent가 backend 기본 경로가 됨
  - approvals API가 동작
- **완료 조건**
  - `/api/v1/chat/sessions` 멀티턴에서 run 생성/이벤트 저장/재개가 깨지지 않음
  - CLI(`pluto-duck agent-stream`)가 새 이벤트를 문제 없이 출력

#### Phase 3+ (CLI parity) — prompt / memory / skills 시스템 이식

현재 `backend/pluto_duck_backend/agent/core/deep/agent.py`의 system prompt는 최소 정책만 포함하고 있어,
deepagents-cli처럼 “에이전트 런타임의 사용법/규칙/메모리/스킬”을 충분히 안내하지 못한다.
따라서 deepagents-cli의 구성 요소를 최대한 차용하여 backend deep agent에도 유사한 UX를 제공한다.

**참조 구현(가져올 구조)**
- `ref/deepagents-master/libs/deepagents-cli/deepagents_cli/agent.py`
  - `get_system_prompt()`처럼 “런타임 환경/작업 디렉토리/툴 사용법/HITL 규칙”을 시스템 프롬프트에 주입
  - CLI에서는 `agent.md`(사용자) + (선택) 프로젝트 agent.md를 읽어 프롬프트에 추가
- `ref/deepagents-master/libs/deepagents-cli/deepagents_cli/agent_memory.py`
  - “user agent.md + project agent.md”를 state에 로딩하고 시스템 프롬프트에 삽입
  - Memory-first 프로토콜과 “어디에 무엇을 저장할지”를 명확히 안내
- `ref/deepagents-master/libs/deepagents-cli/deepagents_cli/default_agent_prompt.md`
  - 기본 역할/톤/파일 읽기/서브에이전트/투두 사용법 같은 “운영 규칙”을 표준화
- `ref/deepagents-master/libs/deepagents-cli/deepagents_cli/skills/*`
  - `SKILL.md` YAML frontmatter를 스캔해 “skill 이름+설명+경로”를 system prompt에 주입(Progressive Disclosure)
  - 실제 SKILL.md 내용은 필요할 때만 `read_file`로 읽게 유도

**Pluto Duck backend에서의 적용(제약 반영)**
- **shell/스크립트 미허용**: backend 모드에서 `execute`는 노출되지 않으며, skill 스크립트 실행도 금지(정책 유지)
- **HITL 필수**: `write_file/edit_file/task/dbt_*`는 승인 없이는 실행되지 않음(거부 시 재시도 금지)
- **workspace는 conversation_id 기준**: 파일 작업은 `/workspace/**` 하위로 유도

##### (A) Prompt 구성(backend 버전)
CLI의 `get_system_prompt()` + `default_agent_prompt.md`를 합쳐, backend 전용 기본 prompt를 만든다.

- **구성 요소**
  - **Base runtime prompt**: 작업공간, 경로 규칙(`/workspace/**`), 사용 가능한 tool 목록, HITL 규칙
  - **Default behavior prompt**: `default_agent_prompt.md` 스타일(메모리-first, file pagination, todo, subagent 사용법 등)
  - **User/Project memory prompt**: 아래 (B)
  - **Skills prompt**: 아래 (C)

- **구현 형태**
  - `agent/core/deep/prompts/default_agent_prompt.md` (또는 `.txt`)로 기본 템플릿을 소스에 포함
  - `agent/core/deep/agent.py`는 문자열 하드코딩 대신 템플릿을 로딩해 system prompt를 구성

##### (B) Agent Memory(backend 버전)
deepagents-cli의 `AgentMemoryMiddleware` 패턴을 그대로 차용하되, “프로젝트 루트 탐색(.git)” 대신 Pluto Duck의 저장소/설정 기반으로 경로를 결정한다.

- **저장 위치 제안**
  - **User memory**: `{data_dir.root}/deepagents/user/agent.md`
  - **Project memory**(Pluto Duck project_id 기준): `{data_dir.root}/deepagents/projects/{project_id}/agent.md`
  - (선택) 추가 메모 파일: `{data_dir.root}/deepagents/projects/{project_id}/*.md`

- **로딩/우선순위**
  - 프로젝트 메모리가 존재하면 user 메모리 위에 덧붙인다(프로젝트가 더 구체적)
  - memory는 매 turn마다 “변경 반영”을 위해 재로드(또는 mtime 기반 캐시)

- **HITL 연계**
  - memory 파일 업데이트는 `write_file/edit_file`로 수행되므로 자연스럽게 승인 대상이 된다.

##### (C) Skills 시스템(backend 버전)
deepagents-cli `SkillsMiddleware` + `skills/load.py`를 차용해, backend에서도 skill discoverability를 제공한다.

- **저장 위치 제안**
  - **User skills**: `{data_dir.root}/deepagents/user/skills/<skill-name>/SKILL.md`
  - **Project skills**: `{data_dir.root}/deepagents/projects/{project_id}/skills/<skill-name>/SKILL.md`
  - 프로젝트 스킬이 같은 이름이면 user 스킬을 override(CLI와 동일)

- **Progressive Disclosure 규칙**
  - system prompt에는 “skill 목록(이름+설명+SKILL.md 경로)”만 주입
  - 실제 사용 시 에이전트가 `read_file`로 해당 SKILL.md를 읽고 지침을 따른다.

- **스크립트 실행 금지**
  - SKILL 디렉토리에 스크립트가 있어도 backend에서는 실행하지 않는다(문서/템플릿/가이드 용도).

##### (D) 구현 작업 항목(Phase 3+)
- `agent/core/deep/middleware/memory.py`:
  - deepagents-cli `AgentMemoryMiddleware`를 기반으로 “user/project agent.md 로딩 + system prompt 주입” 구현
- `agent/core/deep/middleware/skills.py`:
  - deepagents-cli `SkillsMiddleware`를 기반으로 “skills 메타데이터 로딩 + system prompt 주입” 구현
- `agent/core/deep/agent.py`:
  - system prompt를 템플릿 기반으로 조합(정책 + default_agent_prompt + memory + skills)
- (선택) API:
  - backend에서 skills/memory를 UI로 편집할 수 있게 `settings` 또는 `chat` API에 파일 관리 엔드포인트 추가

### Phase 4 — 테스트/회귀
- **목표**: 노드 기반 테스트를 deep agent 기반으로 재작성하고, HITL/재개/이벤트 회귀를 자동화
- **작업**
  - `backend/tests/agent/*`
    - 기존 reasoning/parser/graph 테스트는 구조가 달라지므로 삭제/재작성
    - 새 테스트 축:
      - “tool-calling 기본 플로우” (schema→run_sql→final)
      - “HITL interrupt/resume” (pending approval 생성 → decision → 완료)
      - “edit decision” (edited_args 반영)
  - `backend/tests/api/*`
    - 기존 DummyManager 기반 테스트는 유지 가능(라우터 contract)
    - 추가: approvals endpoints contract 테스트
  - `backend/tests/api/test_chat_api.py`
    - 멀티턴 + 이벤트 적재 + run_id 갱신 + approvals pending 상태 검증
- **완료 조건**
  - CI에서 테스트 그린
  - 회귀 케이스: 이벤트 저장량/limit 정책이 적용되어도 UI/CLI가 동작

---

## 10) 리스크 및 대응

### 리스크: 의존성 추가로 패키징/빌드 복잡도 증가
- 대응: deepagents는 vendoring + 최소한의 `langchain` 의존만 추가(또는 특정 extras로 분리)

### 리스크: 무한 루프/과도한 tool 호출
- 대응: recursion limit, max tool calls, budget(토큰/시간) 제한을 런타임 설정으로 제공

### 리스크: 파일 접근/실행 보안
- 대응: workspace root 강제, path traversal 차단, **execute 미허용**, 민감 tool(HITL 승인 대상) 범위 명확화

### 리스크: 기존 프론트가 기대하는 이벤트와 불일치
- 대응: 본 문서의 매핑 테이블을 “계약”으로 삼고, 테스트로 고정

---

## 11) HITL 승인/재개 API 설계 초안

이 섹션은 “backend에서 HITL을 어떻게 구현할 것인가”에 대한 **초안**입니다. 구현 시점에 프론트/CLI 요구사항에 맞춰 필드/이벤트는 조정할 수 있습니다.

### 11.1 용어
- **Approval(승인 요청)**: 특정 tool call 실행 전에 사용자 승인을 받아야 하는 “대기 상태”
- **Interrupt(중단)**: tool call 직전에 그래프 실행이 멈추고 승인/거부/편집 결정을 기다리는 상태
- **Resume(재개)**: 승인이 내려간 뒤, 같은 run을 이어서 실행하는 상태

### 11.2 상태 모델(저장; DB)
승인 대기와 재개를 위해 최소 아래 엔티티가 필요합니다.

#### ApprovalRequest (예시 테이블: `agent_tool_approvals`)
- `id` (uuid)
- `conversation_id` (uuid)
- `run_id` (uuid)
- `status` (`pending|approved|rejected|edited|expired|cancelled`)
- `tool_name` (string) — 예: `execute`, `write_file`, `dbt_run`, `task`
- `tool_call_id` (string) — LangChain/LangGraph tool call id
- `request_args` (json) — 원본 args
- `request_preview` (json) — UI/로그용 축약(예: file_path, line_count, command 등)
- `policy` (json) — 왜 승인 대상인지/허용 범위(allowlist/limits) 등
- `decision` (string, nullable) — `approve|reject|edit`
- `edited_args` (json, nullable) — decision=edit 일 때 적용될 args
- `decided_at` (datetime, nullable)
- `decided_by` (string, nullable) — 사용자/시스템(추후 다중 사용자 대비)
- `created_at` (datetime)

#### RunCheckpoint (권장; 재개를 위해 필요)
LangGraph interrupt를 “프로세스 재시작 후에도” 재개하려면 체크포인터/상태가 필요합니다.

선택지:
- **A안(권장)**: LangGraph `Checkpointer`를 DB 구현하여 run 상태를 저장
- **B안(대안)**: orchestrator가 deep agent state 스냅샷을 직렬화하여 DB에 저장(구현 쉬우나 프레임워크 호환/업그레이드 리스크)

초안에서는 A안을 기본으로 가정합니다.

### 11.3 API 엔드포인트(초안)
기존 라우팅 스타일에 맞춰 `agent` 네임스페이스로 제안합니다.

#### (A) Pending approvals 조회
- `GET /api/v1/agent/{run_id}/approvals`
  - 응답: `[{ id, status, tool_name, request_preview, created_at, decided_at }]`

#### (B) 단건 조회
- `GET /api/v1/agent/{run_id}/approvals/{approval_id}`
  - 응답: `{ id, status, tool_name, request_args, request_preview, policy, created_at, decided_at }`

#### (C) 결정 제출(approve/reject/edit)
- `POST /api/v1/agent/{run_id}/approvals/{approval_id}/decision`
  - body:
    - `decision`: `"approve" | "reject" | "edit"`
    - `edited_args` (optional): `object` (decision=edit일 때 필수)
  - 동작:
    - DB에서 approval 상태를 업데이트
    - 관련 run의 interrupt를 해제하고 graph를 **resume**
  - 응답:
    - `{ status: "accepted", approval_id, run_id }`

#### (D) (옵션) run 상태 조회
- `GET /api/v1/agent/{run_id}/status`
  - 응답: `{ run_id, state: "running|waiting_for_approval|completed|failed", pending_approval_id? }`

### 11.4 SSE 이벤트(초안; 기존 스키마 호환)
기존 `AgentEvent`의 `type/subtype`는 유지하고, `content`에 필드를 추가하는 방식으로 확장합니다.

#### 승인 요청 발생(중단)
- `type="tool"`, `subtype="start"`
  - `content` 예시:
    - `tool`: `<tool_name>`
    - `approval_required`: `true`
    - `approval_id`: `<uuid>`
    - `run_id`: `<uuid>`
    - `preview`: `{...}` (file_path/command/dbt target 등)

#### 승인 결정 반영(재개)
- `type="tool"`, `subtype="end"`
  - `content` 예시:
    - `tool`: `<tool_name>`
    - `approval_id`: `<uuid>`
    - `decision`: `"approve"|"reject"|"edit"`
    - `effective_args`: `{...}` (edit이면 edited args, 아니면 원 args)

#### 거부(reject) 시 처리 원칙
- 거부된 tool call은 **재시도하지 않음**
- agent는 다음 중 하나를 수행:
  - 대체 경로(tool/쿼리/파일 읽기 중심)로 진행
  - 사용자에게 추가 확인 질문 후 종료/대기

### 11.5 재개(resume) 시나리오(런타임)
1) run 실행 중 승인 대상 tool call 도달
2) approval row 생성(DB) + SSE로 “approval_required” 이벤트 emit
3) graph 실행은 interrupt 상태로 대기
4) 사용자가 decision API 호출
5) backend가 checkpointer를 통해 해당 run을 resume
6) 이어지는 tool 결과/최종 답변을 기존 SSE stream으로 계속 emit

---

## 12) 남은 결정 사항(Open Questions)

1) (남은 항목 없음) — 현재 시점에서는 `execute`/skills 스크립트/FS 키/reasoning 노출 수준까지 모두 확정.

---

## 13) 다음 액션(구현 전 확인)

이 문서 기준으로 구현을 시작하기 전에 아래를 확인하면 좋습니다.
- 프론트/CLI가 실제로 소비하는 이벤트 필드(특히 planner/schema/sql/verifier)의 strictness
- agent가 파일을 쓰는 위치 정책(프로젝트 경로 vs `~/.pluto-duck/` 하위)
- HITL 승인/재개를 위한 API/DB 스키마(또는 저장 방식) 확정
- (선택) reasoning 이벤트를 “최대”로 노출할 때, UI/로그/DB 저장에서의 비용(용량) 정책 확정(예: 이벤트 저장량 cap)


