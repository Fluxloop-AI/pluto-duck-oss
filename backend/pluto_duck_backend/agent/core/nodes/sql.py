"""SQL generation node."""

from __future__ import annotations

import logging

from pluto_duck_backend.agent.core import AgentState, MessageRole
from pluto_duck_backend.agent.core.llm.providers import get_llm_provider
from pluto_duck_backend.agent.core.prompts import try_load_prompt

logger = logging.getLogger(__name__)

DEFAULT_SQL_PROMPT = (
    "Generate a SELECT SQL query that can answer the user's question using DuckDB tables."
    " Return only SQL code."
)


def build_sql_node():
    prompt_template = try_load_prompt("sql_prompt") or DEFAULT_SQL_PROMPT

    async def sql_node(state: AgentState) -> AgentState:
        provider = get_llm_provider(model=state.model)
        preferred = state.context.get("preferred_tables", []) or state.preferred_tables or []
        other_tables = state.context.get("other_tables", [])
        candidate_tables = state.context.get("preferred_table_candidates", [])
        user_question = state.context.get("sanitized_user_query") or state.user_query
        table_columns = state.context.get("table_columns", {})
        
        logger.info(
            f"[SQL] INPUT STATE - "
            f"preferred={preferred}, "
            f"candidate={candidate_tables}, "
            f"table_columns_keys={list(table_columns.keys()) if isinstance(table_columns, dict) else 'N/A'}"
        )

        if preferred:
            hint = (
                "Preferred tables: "
                + ", ".join(preferred)
                + (f"\nOther tables: {', '.join(other_tables)}" if other_tables else "")
            )
        elif candidate_tables:
            hint = "Candidate tables from user mention: " + ", ".join(candidate_tables)
        else:
            hint = f"Available tables: {', '.join(state.context.get('schema_preview', []))}"

        if isinstance(table_columns, dict) and table_columns:
            column_lines = []
            for table_name, columns in table_columns.items():
                if not columns:
                    continue
                preview = ", ".join(columns[:8])
                if len(columns) > 8:
                    preview += ", …"
                column_lines.append(f"Columns in {table_name}: {preview}")
            if column_lines:
                hint += "\n" + "\n".join(column_lines)

        prompt = (
            f"{prompt_template}\n"
            f"User question: {user_question}\n"
            f"Plan steps: {[step.description for step in state.plan]}\n"
            f"{hint}\n"
        )
        response = await provider.ainvoke(prompt)
        state.working_sql = response.strip()
        state.add_message(MessageRole.ASSISTANT, f"Candidate SQL:\n{state.working_sql}")
        _log("sql_generated", conversation_id=state.conversation_id, sql_preview=state.working_sql[:160])
        return state

    return sql_node


def _log(message: str, **fields: object) -> None:
    payload = " ".join(f"{key}={value}" for key, value in fields.items()) if fields else ""
    print(f"[agent][sql] {message} {payload}")


