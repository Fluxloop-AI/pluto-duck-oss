---
name: sql-analysis
description: Workflow for answering analytical questions with DuckDB using Pluto Duck tools. Use when the user asks to write SQL, analyze data, compute metrics, inspect tables, validate results, or produce a short report from warehouse data.
---

# SQL Analysis (Pluto Duck)

Use this skill to reliably answer analytical questions by inspecting schema, writing SQL, executing it, and summarizing results.

## Workflow

### Step 1: Identify the target data

1. Start with schema discovery:
   - `list_tables`
2. For candidate tables:
   - `describe_table(table_name)`
   - `sample_rows(table_name, limit=5)`

### Step 2: Draft the SQL

Write SQL that is:
- explicit in selected columns
- conservative with joins (confirm keys)
- uses `LIMIT` for previews

If the question is ambiguous, ask 1-2 clarifying questions before running heavy queries.

### Step 3: Execute + validate

1. Run: `run_sql(sql)`
2. If it fails:
   - fix syntax/table names
   - re-run with a smaller query (LIMIT, fewer joins)
3. Sanity checks:
   - row counts
   - null rates for key columns (if relevant)
   - outliers (if relevant)

### Step 4: Produce output

Return:
- the final SQL (unless user asked not to)
- a concise interpretation of the result preview
- assumptions and limitations

Optional: write artifacts under `/workspace/` (tables/SQL/report) if the user wants reproducibility.

## Notes

- Prefer Pluto Duck domain tools (schema + run_sql) over any generic execution.
- Keep intermediate work in `/workspace/`.
- If you need to remember project-specific conventions (table naming, metric definitions), store them in `/memories/` (requires HITL approval).


