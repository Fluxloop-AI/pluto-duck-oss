"""dbt tools (HITL gated).

These tools wrap Pluto Duck's `DbtService`, which executes the dbt CLI.
They are configured as HITL approval targets in `deep/agent.py`.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.tools import StructuredTool

from pluto_duck_backend.app.core.config import get_settings
from pluto_duck_backend.app.services.transformation.service import DbtService


def _build_service(*, artifacts_dir: Path) -> DbtService:
    settings = get_settings()
    return DbtService(
        project_dir=settings.dbt.project_path,
        profiles_dir=settings.dbt.profiles_path or (settings.data_dir.configs / "dbt_profiles"),
        artifacts_dir=artifacts_dir,
        warehouse_path=settings.duckdb.path,
    )


def build_dbt_tools() -> List[StructuredTool]:
    def dbt_run(select: Optional[List[str]] = None, vars: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        settings = get_settings()
        artifacts_dir = settings.data_dir.artifacts / "dbt" / "runs" / str(uuid.uuid4())
        service = _build_service(artifacts_dir=artifacts_dir)
        return service.run(select=select, vars=vars)

    def dbt_test(select: Optional[List[str]] = None) -> Dict[str, Any]:
        settings = get_settings()
        artifacts_dir = settings.data_dir.artifacts / "dbt" / "tests" / str(uuid.uuid4())
        service = _build_service(artifacts_dir=artifacts_dir)
        return service.test(select=select)

    # Minimal: dbt ls/compile aren’t currently exposed by DbtService. Keep placeholders for Phase 2/3.
    def dbt_ls() -> Dict[str, Any]:
        return {"status": "not_implemented", "hint": "Expose dbt ls in DbtService (Phase 2)."}

    def dbt_compile() -> Dict[str, Any]:
        return {"status": "not_implemented", "hint": "Expose dbt compile in DbtService (Phase 2)."}

    return [
        StructuredTool.from_function(name="dbt_run", func=dbt_run, description="Run dbt (HITL approval required)."),
        StructuredTool.from_function(name="dbt_test", func=dbt_test, description="Run dbt tests (HITL approval required)."),
        StructuredTool.from_function(name="dbt_ls", func=dbt_ls, description="List dbt resources (HITL approval required)."),
        StructuredTool.from_function(name="dbt_compile", func=dbt_compile, description="Compile dbt project (HITL approval required)."),
    ]


