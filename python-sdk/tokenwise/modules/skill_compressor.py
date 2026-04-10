"""
Skill Compressor — Reduce token cost of tool/function definitions.
"""

import re

FILLER_PATTERNS = [
    re.compile(r"\bThis (?:function|tool|method) (?:is used to |allows you to |can be used to )", re.I),
    re.compile(r"\bUse this (?:function|tool|method) to ", re.I),
    re.compile(r"\bPlease note that ", re.I),
    re.compile(r"\bIn order to ", re.I),
    re.compile(r"\bbasically ", re.I),
    re.compile(r"\bessentially ", re.I),
]

REMOVABLE_SCHEMA_KEYS = {"examples", "default", "$schema", "title", "additionalProperties"}


class SkillCompressor:
    def __init__(self, max_tools: int = 15):
        self.max_tools = max_tools

    def optimize(self, tools: list[dict], user_message: str | None = None) -> dict:
        optimized = list(tools)

        if user_message and len(tools) > self.max_tools:
            optimized = self._filter_by_relevance(optimized, user_message)

        optimized = [self._compress(t) for t in optimized]

        saved = len(tools) - len(optimized)
        return {
            "tools": optimized,
            "stats": {
                "original_count": len(tools),
                "optimized_count": len(optimized),
                "saved_tokens": max(0, saved * 50),  # rough estimate
            },
        }

    def _filter_by_relevance(self, tools: list[dict], message: str) -> list[dict]:
        msg_lower = message.lower()
        scored = []
        for tool in tools:
            fn = tool.get("function", tool)
            name = fn.get("name", "").lower()
            score = sum(10 for w in msg_lower.split() if w in name)
            scored.append((score, tool))
        scored.sort(key=lambda x: -x[0])
        return [t for _, t in scored[: self.max_tools]]

    def _compress(self, tool: dict) -> dict:
        tool = dict(tool)
        fn = dict(tool.get("function", tool))
        desc = fn.get("description", "")
        for pat in FILLER_PATTERNS:
            desc = pat.sub("", desc)
        desc = re.sub(r"\s+", " ", desc).strip()
        fn["description"] = desc
        if "parameters" in fn:
            fn["parameters"] = self._minify(fn["parameters"])
        tool["function"] = fn
        return tool

    def _minify(self, schema: dict) -> dict:
        return {k: (self._minify(v) if isinstance(v, dict) else v) for k, v in schema.items() if k not in REMOVABLE_SCHEMA_KEYS}
