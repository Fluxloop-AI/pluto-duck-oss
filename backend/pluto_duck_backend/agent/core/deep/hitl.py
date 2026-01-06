"""In-process HITL broker for Phase 3.

We implement HITL as "pause inside tool-call middleware":
- when an approval-required tool is called, create/persist an approval row
- emit an SSE event indicating approval is required
- await a decision (approve/reject/edit) via this broker

This provides true interrupt/resume behavior for a running backend process.
Persisted approvals are stored in DuckDB; cross-process resume is deferred to a
future checkpointer integration.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional

from pluto_duck_backend.agent.core.events import AgentEvent, EventSubType, EventType


@dataclass(frozen=True)
class ApprovalDecision:
    decision: str  # approve|reject|edit
    edited_args: Optional[Dict[str, Any]] = None


class ApprovalBroker:
    def __init__(
        self,
        *,
        emit: Callable[[AgentEvent], Awaitable[None]],
        run_id: str,
    ) -> None:
        self._emit = emit
        self._run_id = run_id
        self._futures: dict[str, asyncio.Future[ApprovalDecision]] = {}

    def create_future(self, approval_id: str) -> asyncio.Future[ApprovalDecision]:
        fut = self._futures.get(approval_id)
        if fut is None or fut.done():
            fut = asyncio.get_running_loop().create_future()
            self._futures[approval_id] = fut
        return fut

    async def wait(self, approval_id: str) -> ApprovalDecision:
        fut = self.create_future(approval_id)
        return await fut

    async def emit_approval_required(self, *, approval_id: str, tool_name: str, preview: dict[str, Any]) -> None:
        await self._emit(
            AgentEvent(
                type=EventType.TOOL,
                subtype=EventSubType.START,
                content={
                    "tool": tool_name,
                    "approval_required": True,
                    "approval_id": approval_id,
                    "preview": preview,
                },
                metadata={"run_id": self._run_id},
            )
        )

    async def emit_decision_applied(
        self,
        *,
        approval_id: str,
        tool_name: str,
        decision: ApprovalDecision,
        effective_args: Optional[dict[str, Any]] = None,
    ) -> None:
        await self._emit(
            AgentEvent(
                type=EventType.TOOL,
                subtype=EventSubType.END,
                content={
                    "tool": tool_name,
                    "approval_id": approval_id,
                    "decision": decision.decision,
                    "effective_args": effective_args,
                },
                metadata={"run_id": self._run_id},
            )
        )

    def decide(self, approval_id: str, decision: ApprovalDecision) -> None:
        fut = self._futures.get(approval_id)
        if fut is None or fut.done():
            # Late decision or already resolved. Keep a future for any waiter.
            fut = self.create_future(approval_id)
        fut.set_result(decision)


