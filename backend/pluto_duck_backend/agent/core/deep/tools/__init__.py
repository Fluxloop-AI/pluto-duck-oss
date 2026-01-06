"""Tooling for Pluto Duck deep agent (Phase 2).

We build tools as factories so we can:
- capture warehouse path
- capture conversation-scoped workspace root (virtual /workspace paths)
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from langchain_core.tools import BaseTool

from pluto_duck_backend.app.core.config import get_settings

from .dbt import build_dbt_tools
from .ingest import build_ingest_tools
from .query import build_query_tools
from .schema import build_schema_tools


def build_default_tools(*, workspace_root: Path) -> List[BaseTool]:
    settings = get_settings()
    warehouse_path = settings.duckdb.path
    return [
        *build_schema_tools(warehouse_path=warehouse_path),
        *build_query_tools(warehouse_path=warehouse_path),
        *build_dbt_tools(),
        *build_ingest_tools(warehouse_path=warehouse_path, workspace_root=workspace_root),
    ]


