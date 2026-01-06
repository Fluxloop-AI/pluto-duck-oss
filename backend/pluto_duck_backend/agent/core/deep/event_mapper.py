"""Event mapping utilities (Phase 1).

This module provides a LangChain callback handler that converts runtime events
into Pluto Duck `AgentEvent` objects for SSE streaming.

Phase 1 scope:
- Define the handler and event shapes.
- Keep implementation conservative to avoid tight coupling to LangChain internals.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from langchain_core.callbacks.base import AsyncCallbackHandler

from pluto_duck_backend.agent.core.events import AgentEvent, EventSubType, EventType


@dataclass(frozen=True)
class EventSink:
    """Pluggable sink for AgentEvents."""

    emit: Callable[[AgentEvent], Awaitable[None]]


class PlutoDuckEventCallbackHandler(AsyncCallbackHandler):
    """Best-effort callback handler emitting Pluto Duck AgentEvents."""

    def __init__(self, *, sink: EventSink, run_id: str) -> None:
        super().__init__()
        self._sink = sink
        self._run_id = run_id

    async def _emit(self, event: AgentEvent) -> None:
        await self._sink.emit(event)

    def _ts(self) -> datetime:
        return datetime.now(timezone.utc)

    async def on_llm_start(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        await self._emit(
            AgentEvent(
                type=EventType.REASONING,
                subtype=EventSubType.START,
                content={"phase": "llm_start"},
                metadata={"run_id": self._run_id},
                timestamp=self._ts(),
            )
        )

    async def on_llm_end(self, response: Any, **kwargs: Any) -> None:  # noqa: ANN401
        text = None
        try:
            # Try to extract first generation text
            gens = getattr(response, "generations", None) or []
            if gens and gens[0]:
                msg = getattr(gens[0][0], "message", None)
                text = getattr(msg, "content", None)
        except Exception:
            text = None
        await self._emit(
            AgentEvent(
                type=EventType.REASONING,
                subtype=EventSubType.CHUNK,
                content={"phase": "llm_end", "text": text},
                metadata={"run_id": self._run_id},
                timestamp=self._ts(),
            )
        )

    async def on_tool_start(self, serialized: dict[str, Any], input_str: str, **kwargs: Any) -> None:  # noqa: ANN401
        tool_name = serialized.get("name") or serialized.get("id") or "tool"
        await self._emit(
            AgentEvent(
                type=EventType.TOOL,
                subtype=EventSubType.START,
                content={"tool": tool_name, "input": input_str},
                metadata={"run_id": self._run_id},
                timestamp=self._ts(),
            )
        )

    async def on_tool_end(self, output: Any, **kwargs: Any) -> None:  # noqa: ANN401
        # We don't know the tool name reliably here without deeper wiring;
        # leave it generic. Phase 3 will enrich this using tool_call_id.
        await self._emit(
            AgentEvent(
                type=EventType.TOOL,
                subtype=EventSubType.END,
                content={"output": output},
                metadata={"run_id": self._run_id},
                timestamp=self._ts(),
            )
        )


