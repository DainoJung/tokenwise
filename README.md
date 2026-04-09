<h1 align="center">
  TokenWise
</h1>

<p align="center">
  <strong>Spend less, agent more.</strong>
</p>

<p align="center">
  Drop-in token optimization SDK for Agentic AI.<br/>
  Reduce LLM API costs by 40–80% — no code rewrite needed.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@daino/tokenwise"><img src="https://img.shields.io/npm/v/@daino/tokenwise?style=flat-square&color=black" alt="npm"></a>
  <a href="https://github.com/DainoJung/tokenwise/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="license"></a>
  <a href="https://github.com/DainoJung/tokenwise"><img src="https://img.shields.io/github/stars/DainoJung/tokenwise?style=flat-square&color=black" alt="stars"></a>
</p>

---

## The Problem

Agentic AI systems burn through tokens at alarming rates:

- **Stateless repetition** — 30-40% of tokens are redundant context resent every turn
- **Tool bloat** — 10-50 tool definitions sent per call, most irrelevant
- **Wrong model for the job** — expensive models used for simple tasks
- **No visibility** — you don't know where your tokens go until the bill arrives

## How TokenWise Works

```
Your App ──→ TokenWise ──→ LLM API
                │
                ├── Context Differ     dedup messages, compress history
                ├── Skill Compressor   trim tool descriptions, filter irrelevant
                ├── Model Router       gpt-4o → gpt-4.1-nano for simple tasks
                └── Cost Tracker       log everything, report savings
```

TokenWise sits between your app and the LLM API. It optimizes every request transparently — your code sees the same responses, just cheaper.

| Module | What it does | Savings |
|--------|-------------|---------|
| **Context Differ** | Deduplicates messages, compresses old turns, maximizes cache hits | 20–40% |
| **Skill Compressor** | Removes filler from tool descriptions, filters irrelevant tools | 30–50% |
| **Model Router** | Routes simple tasks to cheaper models automatically | 50–90% per request |
| **Cost Tracker** | Real-time cost monitoring with savings dashboard | visibility |

---

## Quick Start

```bash
npm install @daino/tokenwise
```

### Option 1: SDK — same API, automatic optimization

```typescript
import { TokenWise } from '@daino/tokenwise';

const tw = new TokenWise({
  apiKey: process.env.OPENAI_API_KEY,
  verbose: true,
});

// Same API as OpenAI SDK — just cheaper
const response = await tw.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  tools: myTools,  // automatically compressed
});

console.log(tw.printSavings());
```

### Option 2: Proxy — zero code change

Start the proxy, change one line:

```bash
npx tokenwise proxy --port 8787
```

```typescript
// Your existing code — only change base_url
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'http://localhost:8787/v1',  // ← this is it
});

// Everything else stays exactly the same
const response = await openai.chat.completions.create({ ... });
```

```bash
# Check savings anytime
curl http://localhost:8787/v1/tokenwise/report
```

---

## Real Results

```
╔══════════════════════════════════════╗
║       TokenWise Cost Report          ║
╠══════════════════════════════════════╣
║  Requests:                      247 ║
║  Input tokens:            1,203,847 ║
║  Original:                2,891,203 ║
║  Saved tokens:            1,687,356 ║
╠══════════════════════════════════════╣
║  Actual cost:  $          2.4103    ║
║  Without TW:   $          8.6736    ║
║  You saved:    $          6.2633    ║
║  Savings:                   72.2%   ║
╚══════════════════════════════════════╝
```

---

## Configuration

All modules are enabled by default. Toggle what you need:

```typescript
const tw = new TokenWise({
  apiKey: process.env.OPENAI_API_KEY,

  contextDiffer: true,       // dedup & compress messages
  skillCompressor: true,     // trim tool definitions
  modelRouter: true,         // route to cheaper models
  trackCosts: true,          // cost monitoring

  // Custom routing rules
  routingRules: [
    { condition: 'simple', model: 'gpt-4.1-nano' },
    { condition: 'moderate', model: 'gpt-4.1-mini' },
    { condition: 'complex', model: 'gpt-4o' },
  ],

  verbose: true,
});
```

## Advanced: Individual Modules

Use any module standalone:

```typescript
import { SkillCompressor, ModelRouter, ContextDiffer } from '@daino/tokenwise';

// Compress tools independently
const compressor = new SkillCompressor({ maxTools: 10 });
const { tools, stats } = compressor.optimize(myTools, userMessage);

// Route models independently
const router = new ModelRouter();
const { model, complexity } = router.route('gpt-4o', messages, tools);
```

---

## Supported Models

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-5, gpt-5-mini, o3, o4-mini |
| **Anthropic** | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |

---

## Roadmap

- [x] Context Differ — message dedup + compression
- [x] Skill Compressor — tool description optimization
- [x] Model Router — complexity-based routing
- [x] Cost Tracker — real-time monitoring
- [x] Proxy Server — zero code change mode
- [ ] Streaming support
- [ ] Anthropic API native support
- [ ] Shared State Store — cross-agent context sharing
- [ ] Smart Wake Gate — idle agent suppression
- [ ] Output Compactor — response format optimization
- [ ] Web dashboard for cost analytics
- [ ] Python SDK (`pip install tokenwise`)

---

## Contributing

PRs welcome. This project aims to make Agentic AI affordable for everyone.

```bash
git clone https://github.com/DainoJung/tokenwise.git
cd tokenwise
npm install
npm run build
```

## License

MIT
