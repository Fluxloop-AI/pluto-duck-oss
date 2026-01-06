"""Schema/metadata tools for the DuckDB warehouse."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb
from langchain_core.tools import StructuredTool


def _jsonable(value: Any) -> Any:
    # duckdb returns Python primitives usually; keep best-effort fallback.
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def build_schema_tools(*, warehouse_path: Path) -> List[StructuredTool]:
    """Return schema tools bound to a specific DuckDB warehouse."""

    def list_tables(
        schema: str = "main",
        limit: int = 200,
        include_views: bool = False,
    ) -> Dict[str, Any]:
        with duckdb.connect(str(warehouse_path)) as con:
            table_types = ["BASE TABLE"]
            if include_views:
                table_types.append("VIEW")
            rows = con.execute(
                """
                SELECT table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = ? AND table_type IN ?
                ORDER BY table_name
                LIMIT ?
                """,
                [schema, table_types, int(limit)],
            ).fetchall()
        return {
            "schema": schema,
            "tables": [{"name": name, "type": ttype} for (name, ttype) in rows],
        }

    def describe_table(table: str, schema: str = "main") -> Dict[str, Any]:
        qualified = f"{schema}.{table}" if schema else table
        with duckdb.connect(str(warehouse_path)) as con:
            info = con.execute(f"PRAGMA table_info('{qualified}')").fetchall()
            # (cid, name, type, notnull, dflt_value, pk)
            columns = [
                {
                    "name": row[1],
                    "type": row[2],
                    "not_null": bool(row[3]),
                    "default": _jsonable(row[4]),
                    "primary_key": bool(row[5]),
                }
                for row in info
            ]
            try:
                row_count = con.execute(f"SELECT COUNT(*) FROM {qualified}").fetchone()[0]
            except Exception:
                row_count = None
        return {"table": qualified, "columns": columns, "row_count": row_count}

    def sample_rows(table: str, schema: str = "main", limit: int = 5) -> Dict[str, Any]:
        qualified = f"{schema}.{table}" if schema else table
        with duckdb.connect(str(warehouse_path)) as con:
            cur = con.execute(f"SELECT * FROM {qualified} LIMIT ?", [int(limit)])
            cols = [d[0] for d in cur.description] if cur.description else []
            rows = cur.fetchall()
        return {
            "table": qualified,
            "rows": [{cols[i]: _jsonable(row[i]) for i in range(len(cols))} for row in rows],
        }

    return [
        StructuredTool.from_function(name="list_tables", func=list_tables, description="List tables in DuckDB warehouse."),
        StructuredTool.from_function(
            name="describe_table",
            func=describe_table,
            description="Describe a DuckDB table (columns, types, row count).",
        ),
        StructuredTool.from_function(
            name="sample_rows",
            func=sample_rows,
            description="Fetch sample rows from a DuckDB table.",
        ),
    ]


