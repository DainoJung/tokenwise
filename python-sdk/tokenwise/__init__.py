"""
TokenWise — Spend less, agent more.
Token optimization SDK for Agentic AI (Python).

Usage:
    from tokenwise import TokenWise

    tw = TokenWise(api_key="sk-...")
    response = tw.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(tw.print_savings())
"""

__version__ = "0.1.0"

from .client import TokenWise
from .modules.skill_compressor import SkillCompressor
from .modules.model_router import ModelRouter
from .modules.cost_tracker import CostTracker

__all__ = ["TokenWise", "SkillCompressor", "ModelRouter", "CostTracker"]
