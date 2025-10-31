"""Schema exploration node."""

from __future__ import annotations

import logging
from typing import Dict, List

import duckdb

from pluto_duck_backend.agent.core import AgentState, MessageRole
from pluto_duck_backend.agent.core.prompts import try_load_prompt
from pluto_duck_backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_SCHEMA_PROMPT = "Summarize available tables for the user."


def build_schema_node():
    settings = get_settings()
    prompt = try_load_prompt("schema_prompt") or DEFAULT_SCHEMA_PROMPT

    async def schema_node(state: AgentState) -> AgentState:
        table_columns: Dict[str, List[str]] = {}
        with duckdb.connect(str(settings.duckdb.path)) as con:
            rows = con.execute("SHOW TABLES").fetchall()
            all_tables = [row[0] for row in rows]

            def _collect_columns(table_names: List[str]) -> None:
                for table_name in table_names:
                    try:
                        describe_rows = con.execute(f"DESCRIBE {table_name}").fetchall()
                    except duckdb.Error:
                        describe_rows = []
                    if describe_rows:
                        table_columns[table_name] = [str(row[0]) for row in describe_rows]

            prioritized_tables: List[str] = []
            other_tables: List[str] = []

            preferred = state.preferred_tables or []
            preferred_set = set(preferred)

            prioritized_tables = [table for table in all_tables if table in preferred_set]
            other_tables = [table for table in all_tables if table not in preferred_set]

            targets_for_columns: List[str]
            if prioritized_tables:
                targets_for_columns = prioritized_tables
            else:
                targets_for_columns = other_tables[:1]

            _collect_columns(targets_for_columns)

        state.context["schema_preview"] = prioritized_tables + other_tables
        state.context["preferred_tables"] = prioritized_tables
        state.context["other_tables"] = other_tables
        state.context["table_columns"] = table_columns
        state.context["schema_completed"] = True

        logger.info(
            f"[SCHEMA] Context set - conversation_id={state.conversation_id}, "
            f"prioritized={prioritized_tables}, "
            f"table_columns_keys={list(table_columns.keys())}, "
            f"column_counts={{{', '.join(f'{name}: {len(cols)}' for name, cols in table_columns.items())}}}"
        )
        
        _log(
            "schema_context_set",
            conversation_id=state.conversation_id,
            prioritized=prioritized_tables,
            table_columns_keys=list(table_columns.keys()),
            column_counts={name: len(cols) for name, cols in table_columns.items()},
        )

        if prioritized_tables:
            summary_lines = [
                "Priority tables: " + ", ".join(prioritized_tables),
            ]
            for table_name in prioritized_tables:
                columns = table_columns.get(table_name)
                if columns:
                    preview = ", ".join(columns[:8])
                    if len(columns) > 8:
                        preview += ", …"
                    summary_lines.append(f"- Columns in {table_name}: {preview}")
            if other_tables:
                summary_lines.append("Other tables: " + ", ".join(other_tables))
            summary = "\n".join(summary_lines)
            _log(
                "schema_preview_prioritized",
                conversation_id=state.conversation_id,
                preferred_count=len(prioritized_tables),
                other_count=len(other_tables),
            )
        else:
            summary = (
                f"Schema preview: {', '.join(all_tables)}" if all_tables else "No tables found."
            )
            if all_tables:
                summary += "\nLet me know which table to analyze."
                sample_table = targets_for_columns[0] if targets_for_columns else None
                if sample_table:
                    columns = table_columns.get(sample_table)
                    if columns:
                        preview = ", ".join(columns[:8])
                        if len(columns) > 8:
                            preview += ", …"
                        summary += f"\nSample columns from {sample_table}: {preview}"
            state.context["needs_table_confirmation"] = True
            _log(
                "schema_preview",
                conversation_id=state.conversation_id,
                table_count=len(all_tables),
            )
        if prioritized_tables:
            state.context.pop("needs_table_confirmation", None)

        state.add_message(MessageRole.ASSISTANT, summary)
        return state

    return schema_node


def _log(message: str, **fields: object) -> None:
    payload = " ".join(f"{key}={value}" for key, value in fields.items()) if fields else ""
    print(f"[agent][schema] {message} {payload}")


