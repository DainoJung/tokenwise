"""
TokenWise Client — OpenAI-compatible wrapper with automatic optimization.
"""

from openai import OpenAI
from .modules.skill_compressor import SkillCompressor
from .modules.model_router import ModelRouter
from .modules.cost_tracker import CostTracker


class _Completions:
    def __init__(self, client: "TokenWise"):
        self._client = client

    def create(self, **kwargs):
        return self._client._create_completion(**kwargs)


class _Chat:
    def __init__(self, client: "TokenWise"):
        self.completions = _Completions(client)


class TokenWise:
    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        skill_compressor: bool = True,
        model_router: bool = True,
        track_costs: bool = True,
        verbose: bool = False,
    ):
        self._openai = OpenAI(api_key=api_key, base_url=base_url)
        self._skill_compressor = SkillCompressor() if skill_compressor else None
        self._model_router = ModelRouter() if model_router else None
        self._cost_tracker = CostTracker() if track_costs else None
        self._verbose = verbose
        self._request_count = 0
        self.chat = _Chat(self)

    def _create_completion(self, **kwargs):
        self._request_count += 1
        original_model = kwargs.get("model", "gpt-4o")
        optimizations = []

        # Skill compression
        if self._skill_compressor and kwargs.get("tools"):
            messages = kwargs.get("messages", [])
            last_user = next(
                (m["content"] for m in reversed(messages) if m["role"] == "user"),
                None,
            )
            result = self._skill_compressor.optimize(kwargs["tools"], last_user)
            kwargs["tools"] = result["tools"]
            if result["stats"]["saved_tokens"] > 0:
                optimizations.append(f"skill-compressor:-{result['stats']['saved_tokens']}tok")

        # Model routing
        if self._model_router:
            result = self._model_router.route(
                kwargs.get("model", "gpt-4o"),
                kwargs.get("messages", []),
                kwargs.get("tools"),
            )
            kwargs["model"] = result["model"]
            if result["was_routed"]:
                optimizations.append(f"model-router:{original_model}→{result['model']}")

        if self._verbose and optimizations:
            print(f"[TokenWise #{self._request_count}] {', '.join(optimizations)}")

        response = self._openai.chat.completions.create(**kwargs)

        if self._cost_tracker and response.usage:
            self._cost_tracker.record(
                model=kwargs["model"],
                original_model=original_model,
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
                original_input_tokens=response.usage.prompt_tokens,
                optimizations=optimizations,
            )

        return response

    def savings(self) -> dict:
        if self._cost_tracker:
            return self._cost_tracker.get_summary()
        return {}

    def print_savings(self) -> str:
        if self._cost_tracker:
            return self._cost_tracker.print_summary()
        return "Cost tracking disabled."
