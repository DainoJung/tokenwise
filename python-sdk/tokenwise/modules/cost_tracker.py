"""
Cost Tracker — Real-time cost monitoring and savings reporting.
"""

MODEL_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4.1": {"input": 2.00, "output": 8.00},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "gpt-5": {"input": 5.00, "output": 15.00},
    "gpt-5-mini": {"input": 0.50, "output": 2.00},
    "o3": {"input": 10.00, "output": 40.00},
    "o4-mini": {"input": 1.10, "output": 4.40},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-opus-4-6": {"input": 15.00, "output": 75.00},
    "claude-haiku-4-5": {"input": 0.80, "output": 4.00},
}

FALLBACK = {"input": 2.50, "output": 10.00}


class CostTracker:
    def __init__(self):
        self._records: list[dict] = []

    def record(self, *, model: str, original_model: str, input_tokens: int, output_tokens: int, original_input_tokens: int, optimizations: list[str]) -> dict:
        pricing = MODEL_PRICING.get(model, FALLBACK)
        orig_pricing = MODEL_PRICING.get(original_model, FALLBACK)
        cost = (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
        orig_cost = (original_input_tokens * orig_pricing["input"] + output_tokens * orig_pricing["output"]) / 1_000_000

        rec = {
            "model": model,
            "original_model": original_model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
            "original_cost_usd": orig_cost,
            "savings_usd": max(0, orig_cost - cost),
            "optimizations": optimizations,
        }
        self._records.append(rec)
        return rec

    def get_summary(self) -> dict:
        total_cost = sum(r["cost_usd"] for r in self._records)
        total_orig = sum(r["original_cost_usd"] for r in self._records)
        return {
            "total_requests": len(self._records),
            "total_cost_usd": total_cost,
            "total_original_cost_usd": total_orig,
            "total_savings_usd": max(0, total_orig - total_cost),
            "savings_percent": ((total_orig - total_cost) / total_orig * 100) if total_orig > 0 else 0,
        }

    def print_summary(self) -> str:
        s = self.get_summary()
        return (
            f"TokenWise: {s['total_requests']} requests | "
            f"Cost: ${s['total_cost_usd']:.4f} | "
            f"Saved: ${s['total_savings_usd']:.4f} ({s['savings_percent']:.1f}%)"
        )
