"""Deep-agent (deepagents-style) integration layer for Pluto Duck.

Phase 1 note:
- This package is intentionally not wired into `agent/core/orchestrator.py` yet.
- It provides the minimal building blocks (model wrapper, agent builder, HITL middleware)
  that Phase 3 will use to replace the legacy node-based graph.
"""


