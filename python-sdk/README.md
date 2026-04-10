# TokenWise Python SDK

<p>
  <a href="https://pypi.org/project/tokenwise-ai/"><img src="https://img.shields.io/pypi/v/tokenwise-ai?style=flat-square&color=black" alt="pypi"></a>
  <a href="https://github.com/DainoJung/tokenwise/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="license"></a>
</p>

**Spend less, agent more.** Token optimization SDK for Agentic AI.

Reduce LLM API costs by 40-80% with drop-in optimization — no code rewrite needed.

## Install

```bash
pip install tokenwise-ai
```

## Quick Start

```python
from tokenwise import TokenWise

tw = TokenWise(api_key="sk-...")
response = tw.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(tw.print_savings())
```

## What It Does

TokenWise sits between your app and the LLM API, optimizing every request transparently.

| Module | What it does | Savings |
|--------|-------------|---------|
| **Skill Compressor** | Removes filler from tool descriptions, filters irrelevant tools | 30-50% |
| **Model Router** | Routes simple tasks to cheaper models automatically | 50-90% per request |
| **Cost Tracker** | Real-time cost monitoring with savings reporting | visibility |

## Configuration

```python
tw = TokenWise(
    api_key="sk-...",
    skill_compressor=True,   # trim tool definitions
    model_router=True,       # route to cheaper models
    track_costs=True,        # cost monitoring
    verbose=True,            # log optimizations
)
```

## Individual Modules

```python
from tokenwise import SkillCompressor, ModelRouter, CostTracker

# Compress tools independently
compressor = SkillCompressor(max_tools=10)
result = compressor.optimize(my_tools, user_message)

# Route models independently
router = ModelRouter()
result = router.route("gpt-4o", messages, tools)
```

## Supported Models

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5, gpt-5-mini, o3, o4-mini |
| **Anthropic** | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |

## Node.js / TypeScript

Looking for the TypeScript SDK? See [@daino/tokenwise](https://www.npmjs.com/package/@daino/tokenwise) on npm.

```bash
npm install @daino/tokenwise
```

## License

MIT
