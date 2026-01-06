"""Ingestion tools.

Note: shell execution is disallowed; ingestion is performed through Pluto Duck services.
For file-based connectors (csv/parquet), we support workspace-virtual paths by mapping
`/workspace/...` into the conversation workspace root.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from langchain_core.tools import StructuredTool

from pluto_duck_backend.app.services.ingestion import IngestionJob, IngestionService, get_registry


def _resolve_workspace_path(workspace_root: Path, path: str) -> str:
    if path.startswith("/workspace/"):
        rel = path[len("/workspace/") :]
        return str((workspace_root / rel).resolve())
    if path.startswith("/"):
        # Disallow arbitrary absolute paths for safety.
        raise ValueError("Only /workspace/* paths are allowed for ingestion file connectors.")
    # Treat relative as workspace-relative.
    return str((workspace_root / path).resolve())


def build_ingest_tools(*, warehouse_path: Path, workspace_root: Path) -> List[StructuredTool]:
    def ingest_source(
        connector: str,
        target_table: str,
        config: Dict[str, Any] | None = None,
        overwrite: bool = False,
    ) -> Dict[str, Any]:
        cfg: Dict[str, Any] = dict(config or {})

        # Normalize file connector paths into real filesystem paths under workspace.
        if connector in {"csv", "parquet"} and "path" in cfg:
            cfg["path"] = _resolve_workspace_path(workspace_root, str(cfg["path"]))

        service = IngestionService(get_registry())
        job = IngestionJob(
            connector=connector,
            warehouse_path=warehouse_path,
            config=cfg,
            target_table=target_table,
            overwrite=bool(overwrite),
        )
        result = service.run(job)
        return {"status": "success", **result, "target_table": target_table}

    def list_connectors() -> Dict[str, Any]:
        registry = get_registry()
        return {"connectors": list(registry.list_connectors())}

    return [
        StructuredTool.from_function(
            name="ingest_source",
            func=ingest_source,
            description="Ingest data via a connector into DuckDB warehouse (file paths must be under /workspace/*).",
        ),
        StructuredTool.from_function(
            name="list_connectors",
            func=list_connectors,
            description="List available ingestion connectors.",
        ),
    ]


