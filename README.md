# Pluto-Duck OSS

Local-first analytics studio powered by DuckDB, dbt, and an AI-assisted query agent.

<p align="center">
  <img src="docs/screen1.png" alt="Chat Interface" width="45%" />
  <img src="docs/screen2.png" alt="Data Sources" width="45%" />
</p>

## Product Vision

**Pluto Duck** is a **local-first data analytics environment** for individuals and small teams.
Get powerful analytics capabilities without uploading your data to the cloud.

### Core Values

- **🔒 Privacy First**: All data and computation stay on your local machine, never transmitted externally
- **💬 Natural Language Queries**: Ask questions and get insights by conversing with an AI agent
- **🚀 High Performance**: DuckDB-powered analytics engine handles large datasets with speed
- **🔌 Flexible Connectivity**: Easily connect CSV, Parquet, PostgreSQL, SQLite, and more
- **🛠️ Professional Grade**: Structured data transformation management through dbt integration

## Product Direction

Pluto Duck evolves in stages, developing in the following directions:

1. **Personal Data IDE**: A comfortable local workspace for developers and data analysts
2. **Accessibility Expansion**: Multiple interfaces including CLI, web, and desktop applications
3. **Open Source First**: Transparent development growing with the community
4. **(Future) Hybrid Options**: Optional cloud capabilities for scalability when needed

## Project Layout

- `backend/pluto_duck_backend`: FastAPI service, ingestion/transformation engines, and AI agent.
- `packages/pluto_duck_cli`: Typer-based CLI entrypoint (`pluto-duck`).
- `frontend/pluto_duck_frontend`: Minimal chat/front-end client (placeholder).
- `dbt_projects/core`: Reference dbt project used by the transformation service.
- `legacy/`: Snapshot of prior closed-source implementation for reference only (ignored by git).

## Getting Started

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .[dev]

# Run linters/tests
ruff check backend packages
mypy backend packages
pytest backend

# Run API locally
pluto-duck run

# Stream agent events for a natural-language question
pluto-duck agent-stream "List customers"
```

Agent responses are also available via `/api/v1/agent/{run_id}/events` as SSE streams. Each event carries structured JSON describing reasoning updates, tool outputs, and final summaries (see `docs/ARCHITECTURE.md`). For CLI instructions using a real GPT provider, refer to `docs/AGENT_CLI_GUIDE.md`.

## Desktop App (macOS)

### Development

```bash
# Start backend + frontend + Tauri in dev mode
./scripts/dev.sh
```

### Building

```bash
# Build unsigned .app (for local testing)
./scripts/build.sh

# Output:
# - tauri-shell/src-tauri/target/release/bundle/macos/Pluto Duck.app
# - tauri-shell/src-tauri/target/release/bundle/dmg/Pluto Duck_0.1.0_aarch64.dmg
```

### Code Signing & Distribution

**서명 없이 배포** (다른 Mac에서 실행 시):
```bash
# 사용자가 실행:
xattr -cr "/path/to/Pluto Duck.app"
```

**서명하여 배포** (Apple Developer 계정 필요):
```bash
# 1. 인증서 확인
security find-identity -v -p codesigning

# 2. 서명된 앱 빌드
CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAM_ID)" \
./scripts/build-signed.sh

# 3. (선택) 노터라이제이션까지 완료
CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAM_ID)" \
NOTARIZE=true \
./scripts/build-signed.sh
```

상세 가이드: `docs/CODESIGNING.md` 또는 `docs/QUICK_START_CODESIGNING.md`

## Roadmap Highlights

- Phase 1: Extract clean OSS backend, focus on ingestion, dbt integration, public API, CLI.
- Phase 2: Ship minimal chat frontend for end-to-end local experience.
- Phase 3: Prepare for optional managed/cloud offering with premium features.
- **Phase 5: macOS desktop app with Tauri** ✅ **완료**

See `docs/plans/` for detailed design notes.

