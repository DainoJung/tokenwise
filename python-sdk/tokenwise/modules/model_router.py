"""
Model Router — Route requests to cost-appropriate models.
"""

import re

DOWNGRADE_MAP = {
    "gpt-4o": {"simple": "gpt-4.1-nano", "moderate": "gpt-4.1-mini", "complex": "gpt-4o"},
    "gpt-4.1": {"simple": "gpt-4.1-nano", "moderate": "gpt-4.1-mini", "complex": "gpt-4.1"},
    "gpt-5": {"simple": "gpt-5-mini", "moderate": "gpt-5-mini", "complex": "gpt-5"},
    "claude-opus-4-6": {"simple": "claude-haiku-4-5", "moderate": "claude-sonnet-4-6", "complex": "claude-opus-4-6"},
    "claude-sonnet-4-6": {"simple": "claude-haiku-4-5", "moderate": "claude-sonnet-4-6", "complex": "claude-sonnet-4-6"},
}

SKIP_MODELS = {"gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-5-mini", "o4-mini", "claude-haiku-4-5"}


class ModelRouter:
    def route(self, model: str, messages: list[dict], tools: list[dict] | None = None) -> dict:
        if model in SKIP_MODELS:
            return {"model": model, "complexity": "simple", "was_routed": False}

        complexity = self._classify(messages, tools)
        mapping = DOWNGRADE_MAP.get(model)
        if not mapping:
            return {"model": model, "complexity": complexity, "was_routed": False}

        target = mapping.get(complexity, model)
        return {"model": target, "complexity": complexity, "was_routed": target != model}

    def _classify(self, messages: list[dict], tools: list[dict] | None = None) -> str:
        score = 0
        tool_count = len(tools) if tools else 0
        if tool_count > 10:
            score += 25
        elif tool_count > 3:
            score += 10

        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        if last_user:
            if re.search(r"\b(then|after that|next|finally|step \d)\b", last_user, re.I):
                score += 20
            if re.search(r"\b(analyze|compare|evaluate|reason|design|architect)\b", last_user, re.I):
                score += 20
            if len(last_user) > 200:
                score += 15
            elif len(last_user) < 50:
                score -= 15

        if score <= 15:
            return "simple"
        elif score <= 40:
            return "moderate"
        return "complex"
