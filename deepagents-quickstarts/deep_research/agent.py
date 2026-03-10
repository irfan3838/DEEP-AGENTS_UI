from datetime import datetime
from typing import Any, Awaitable, Callable

from langchain_core.messages import BaseMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import create_deep_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import ModelRequest, ModelResponse
from research_agent.prompts import (
    RESEARCHER_INSTRUCTIONS,
    RESEARCH_WORKFLOW_INSTRUCTIONS,
    SUBAGENT_DELEGATION_INSTRUCTIONS,
)
from research_agent.tools import tavily_search, think_tool, write_file, set_chat_title

max_concurrent_research_units = 3
max_researcher_iterations = 3
current_date = datetime.now().strftime("%Y-%m-%d")

INSTRUCTIONS = (
    RESEARCH_WORKFLOW_INSTRUCTIONS
    + "\n\n" + "=" * 80 + "\n\n"
    + SUBAGENT_DELEGATION_INSTRUCTIONS.format(
        max_concurrent_research_units=max_concurrent_research_units,
        max_researcher_iterations=max_researcher_iterations,
    )
)

research_sub_agent = {
    "name": "research-agent",
    "description": "Delegate research to the sub-agent researcher. Only give this researcher one topic at a time.",
    "system_prompt": RESEARCHER_INSTRUCTIONS.format(date=current_date),
    "tools": [tavily_search, think_tool],
}

# ---------------------------------------------------------------------------
# Multimodal pre-processor for Google GenAI
#
# The frontend sends images / PDFs using the @langchain/core content-block
# schema:
#   { type: "image",  mimeType: "image/png",       data: "<base64>" }
#   { type: "file",   mimeType: "application/pdf", data: "<base64>" }
#
# ChatGoogleGenerativeAI does NOT understand these types – it only knows:
#   { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
#   { type: "media",     mime_type: "...",           data: "..." }
#
# We fix this using deepagents' AgentMiddleware.wrap_model_call / awrap_model_call
# hooks so we can rewrite the messages before they reach the model WITHOUT
# wrapping the model object itself (which breaks deepagents' resolve_model check).
# ---------------------------------------------------------------------------

def _convert_part(part: dict) -> dict:
    """Re-map a single content-block part to what ChatGoogleGenerativeAI expects."""
    part_type = part.get("type", "")

    if part_type == "image":
        mime = part.get("mimeType") or part.get("mime_type", "image/jpeg")
        data = part.get("data", "")
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{data}"},
        }

    if part_type == "file":
        mime = part.get("mimeType") or part.get("mime_type", "application/pdf")
        data = part.get("data", "")
        return {
            "type": "media",
            "mime_type": mime,
            "data": data,
        }

    # text, tool_use, tool_result, image_url, media ... pass through unchanged
    return part


def _preprocess_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Convert multimodal content blocks in HumanMessages for Google GenAI."""
    result: list[BaseMessage] = []
    for msg in messages:
        if isinstance(msg, HumanMessage) and isinstance(msg.content, list):
            new_content: list[Any] = [
                _convert_part(p) if isinstance(p, dict) else p
                for p in msg.content
            ]
            result.append(HumanMessage(content=new_content, id=msg.id))
        else:
            result.append(msg)
    return result


class GeminiMultimodalMiddleware(AgentMiddleware):
    """
    Middleware that rewrites HumanMessage multimodal content blocks into the
    format that langchain_google_genai (ChatGoogleGenerativeAI) accepts.

    Uses deepagents' wrap_model_call / awrap_model_call hooks so the actual
    model object is NOT wrapped – only the messages are rewritten before
    each model call.
    """

    name = "gemini_multimodal"

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        new_request = request.override(messages=_preprocess_messages(request.messages))
        return handler(new_request)

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        new_request = request.override(messages=_preprocess_messages(request.messages))
        return await handler(new_request)


# ✅ Gemini model (passed directly – no wrapping needed)
model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.0)

agent = create_deep_agent(
    model=model,
    tools=[tavily_search, think_tool, write_file, set_chat_title],
    system_prompt=INSTRUCTIONS,
    subagents=[research_sub_agent],
    middleware=[GeminiMultimodalMiddleware()],
)