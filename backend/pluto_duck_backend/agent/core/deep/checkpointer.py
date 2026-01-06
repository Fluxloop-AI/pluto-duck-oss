"""DuckDB-backed checkpointer (stub for Phase 1).

We need a LangGraph checkpointer to support interrupt/resume across process restarts.
However, the exact checkpointer interface depends on the installed `langgraph` version.

This module provides a *conditional* implementation:
- If LangGraph exposes the legacy `BaseCheckpointSaver` interface, we implement it.
- Otherwise, we raise a clear error so we can adjust when the runtime env is available.

Phase 1 intent:
- provide the code location + storage mapping to `agent_checkpoints`
- keep the rest of the deep-agent wiring unblocked
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Iterator, Optional
from uuid import uuid4

import duckdb


@dataclass(frozen=True)
class DuckDBCheckpointerConfig:
    warehouse_path: str
    run_id: str


class DuckDBCheckpointer:  # pragma: no cover - runtime dependent
    """Best-effort LangGraph checkpointer using DuckDB table `agent_checkpoints`."""

    def __init__(self, *, config: DuckDBCheckpointerConfig) -> None:
        self._config = config

        # Late imports to avoid hard coupling at import time.
        try:
            from langgraph.checkpoint.base import BaseCheckpointSaver  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(
                "LangGraph checkpointer interface not available in this environment. "
                "Install langgraph and adjust DuckDBCheckpointer to match its checkpointer API."
            ) from exc

        # Dynamically create a subclass instance at runtime if needed.
        self._base_cls = BaseCheckpointSaver

    def _connect(self) -> duckdb.DuckDBPyConnection:
        return duckdb.connect(self._config.warehouse_path)

    # --- Legacy BaseCheckpointSaver-style methods (best guess) ---
    def put(self, config: dict[str, Any], checkpoint: Any, metadata: Any, new_versions: Any) -> dict[str, Any]:
        checkpoint_id = str(uuid4())
        payload = json.dumps(
            {"checkpoint": checkpoint, "metadata": metadata, "new_versions": new_versions},
            default=str,
        )
        with self._connect() as con:
            con.execute(
                """
                INSERT INTO agent_checkpoints (id, run_id, checkpoint_key, payload, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                [checkpoint_id, self._config.run_id, "latest", payload, datetime.now(UTC)],
            )
        return config

    def get_tuple(self, config: dict[str, Any]) -> Optional[Any]:
        with self._connect() as con:
            row = con.execute(
                """
                SELECT payload
                FROM agent_checkpoints
                WHERE run_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                [self._config.run_id],
            ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row[0])
        except Exception:
            return row[0]

    def list(self, config: dict[str, Any], filter: Any = None, before: Any = None, limit: int = 10) -> Iterator[Any]:
        with self._connect() as con:
            rows = con.execute(
                """
                SELECT payload
                FROM agent_checkpoints
                WHERE run_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                [self._config.run_id, int(limit)],
            ).fetchall()
        for (payload,) in rows:
            try:
                yield json.loads(payload)
            except Exception:
                yield payload


