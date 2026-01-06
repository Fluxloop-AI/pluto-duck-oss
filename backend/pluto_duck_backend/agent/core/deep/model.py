"""LangChain ChatModel wrapper around Pluto Duck's BaseLLMProvider.

Pluto Duck already has `BaseLLMProvider.ainvoke(prompt: str) -> str`.
Deepagents / LangChain agents expect a chat model interface that consumes messages.

This wrapper provides a minimal bridge:
- render chat messages into a plain-text prompt
- call the existing provider
- return an `AIMessage` as the model output

Note:
- This is deliberately simple for Phase 1. In Phase 2/3 we can add:
  - streaming support (token/chunk level) for maximum reasoning events
  - richer prompt formatting / tool call formatting
"""

from __future__ import annotations

import json
from typing import Any, List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from pluto_duck_backend.agent.core.llm.providers import BaseLLMProvider


def render_messages_as_prompt(messages: List[BaseMessage]) -> str:
    parts: list[str] = []
    for msg in messages:
        role = getattr(msg, "type", msg.__class__.__name__).lower()
        content = getattr(msg, "content", "")
        if not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False, default=str)
        parts.append(f"[{role}] {content}")
    return "\n".join(parts).strip()


class PlutoDuckChatModel(BaseChatModel):
    """Bridge Pluto Duck prompt-based provider into a LangChain chat model."""

    def __init__(
        self,
        provider: BaseLLMProvider,
        *,
        model_name: str = "pluto-duck-provider",
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__()
        self._provider = provider
        self._model_name = model_name
        self._metadata = metadata or {}

    @property
    def _llm_type(self) -> str:  # pragma: no cover
        return "pluto-duck"

    @property
    def _identifying_params(self) -> dict[str, Any]:  # pragma: no cover
        return {"model_name": self._model_name}

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,  # noqa: ARG002 - reserved for LangChain
        run_manager: Any = None,  # noqa: ANN401,ARG002 - reserved for LangChain
        **kwargs: Any,  # noqa: ANN401
    ) -> ChatResult:
        """Synchronous generate.

        Notes:
        - FastAPI typically runs inside an event loop; calling `asyncio.run()` would fail.
        - LangChain agents in Pluto Duck are expected to use async paths. If a sync path
          is invoked while a loop is running, we fail with a clear message.
        """
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None and loop.is_running():
            raise RuntimeError(
                "PlutoDuckChatModel._generate was called while an event loop is running. "
                "Use async execution paths (ainvoke/astream) for Pluto Duck agents."
            )

        return asyncio.run(self._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs))

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,  # noqa: ARG002 - reserved for LangChain
        run_manager: Any = None,  # noqa: ANN401,ARG002 - reserved for LangChain
        **kwargs: Any,  # noqa: ANN401
    ) -> ChatResult:
        prompt = render_messages_as_prompt(messages)
        response_text = await self._provider.ainvoke(prompt, metadata=self._metadata)
        ai_message = AIMessage(content=response_text or "")
        return ChatResult(generations=[ChatGeneration(message=ai_message)])


