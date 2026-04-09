# TokenWise

**Spend less, agent more.**

Token optimization SDK for Agentic AI. Drop-in middleware that reduces LLM API costs by 40-80% — no code rewrite needed.

## The Problem

Agentic AI systems burn through tokens at alarming rates:

- **Stateless repetition**: 30-40% of tokens are redundant context resent every turn
- **Tool bloat**: 10-50 tool definitions sent per call, most irrelevant
- **Wrong model for the job**: Expensive models used for simple tasks
- **No visibility**: You don't know where your tokens go until the bill arrives

## How TokenWise Helps

| Module | What it does | Savings |
|--------|-------------|---------|
| **Context Differ** | Deduplicates messages, compresses old turns, maximizes cache hits | 20-40% |
| **Skill Compressor** | Removes filler from tool descriptions, filters irrelevant tools | 30-50% |
| **Model Router** | Routes simple tasks to cheaper models automatically | 50-90% per request |
| **Cost Tracker** | Real-time cost monitoring with savings dashboard | visibility |

## Quick Start

```bash
npm install tokenwise
```

### Option 1: SDK (recommended)

Replace your OpenAI client with TokenWise — same API, automatic optimization:

```typescript
import { TokenWise } from 'tokenwise';

const tw = new TokenWise({
  apiKey: process.env.OPENAI_API_KEY,
  verbose: true,  // see optimizations in console
});

// Same API as OpenAI SDK
const response = await tw.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is 2+2?' },
  ],
  tools: myTools,  // will be automatically compressed
});

// See your savings
console.log(tw.printSavings());
```

### Option 2: Proxy (zero code change)

Start the proxy server and just change your `base_url`:

```bash
npx tokenwise proxy --port 8787
```

```typescript
// Your existing code — only change base_url
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'http://localhost:8787/v1',  // ← only this line changes
});

// Everything else stays the same
const response = await openai.chat.completions.create({ ... });
```

Check savings anytime:
```bash
curl http://localhost:8787/v1/tokenwise/report
```

## Configuration

```typescript
const tw = new TokenWise({
  apiKey: process.env.OPENAI_API_KEY,

  // Toggle modules (all enabled by default)
  contextDiffer: true,
  skillCompressor: true,
  modelRouter: true,
  trackCosts: true,

  // Custom model routing rules
  routingRules: [
    { condition: 'simple', model: 'gpt-4.1-nano' },
    { condition: 'moderate', model: 'gpt-4.1-mini' },
    { condition: 'complex', model: 'gpt-4o' },
  ],

  verbose: true,
});
```

## Advanced: Use Individual Modules

```typescript
import { SkillCompressor, ModelRouter, ContextDiffer } from 'tokenwise';

// Compress tools independently
const compressor = new SkillCompressor({ maxTools: 10 });
const { tools, stats } = compressor.optimize(myTools, userMessage);
console.log(`Saved ${stats.savedTokens} tokens on tools`);

// Route models independently
const router = new ModelRouter();
const { model, complexity } = router.route('gpt-4o', messages, tools);
console.log(`Complexity: ${complexity.level}, using: ${model}`);
```

## Cost Report Example

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

## Roadmap

- [x] Context Differ (message dedup + compression)
- [x] Skill Compressor (tool description optimization)
- [x] Model Router (complexity-based routing)
- [x] Cost Tracker (real-time monitoring)
- [x] Proxy Server (zero code change mode)
- [ ] Streaming support
- [ ] Anthropic Claude support
- [ ] Shared State Store (cross-agent context sharing)
- [ ] Smart Wake Gate (idle agent suppression)
- [ ] Output Compactor (response format optimization)
- [ ] Web dashboard for cost analytics
- [ ] Python SDK (`pip install tokenwise`)

## How It Works

```
Your App → TokenWise → OpenAI API
              │
              ├── Context Differ: dedup messages, compress history
              ├── Skill Compressor: trim tool descriptions, filter irrelevant
              ├── Model Router: gpt-4o → gpt-4.1-mini for simple tasks
              └── Cost Tracker: log everything, report savings
```

TokenWise sits between your application and the LLM API. It optimizes every request transparently — your code sees the same responses, just cheaper.

## License

MIT

## Contributing

PRs welcome! This project aims to make Agentic AI affordable for everyone.
