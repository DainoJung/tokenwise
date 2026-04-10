/**
 * TokenWise Proxy Server
 *
 * Drop-in replacement for OpenAI API.
 * Just change base_url to http://localhost:8787 and get automatic optimization.
 *
 * Usage:
 *   tokenwise proxy --port 8787
 *   // Then in your existing code:
 *   const openai = new OpenAI({ baseURL: 'http://localhost:8787/v1' });
 */

import express from 'express';
import type { Request, Response } from 'express';
import { TokenWise } from '../client';
import type { TokenWiseConfig } from '../types';
import { getDashboardHTML } from './dashboard';

export interface ProxyServerOptions {
  port?: number;
  apiKey?: string;
  verbose?: boolean;
  /** Forward to this base URL (default: https://api.openai.com/v1) */
  targetBaseURL?: string;
}

export function createProxyServer(options: ProxyServerOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const port = options.port || 8787;

  // Create TokenWise client (lazy, per-apiKey)
  const clients = new Map<string, TokenWise>();

  function getClient(apiKey: string): TokenWise {
    if (!clients.has(apiKey)) {
      const config: TokenWiseConfig = {
        apiKey,
        baseURL: options.targetBaseURL,
        verbose: options.verbose ?? true,
        contextDiffer: true,
        skillCompressor: true,
        modelRouter: true,
        trackCosts: true,
      };
      clients.set(apiKey, new TokenWise(config));
    }
    return clients.get(apiKey)!;
  }

  // Dashboard
  app.get('/dashboard', (_req: Request, res: Response) => {
    res.type('text/html').send(getDashboardHTML());
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'tokenwise-proxy', version: '0.1.0' });
  });

  // Savings report
  app.get('/v1/tokenwise/savings', (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    const client = getClient(apiKey);
    res.json(client.savings());
  });

  // Pretty savings report
  app.get('/v1/tokenwise/report', (req: Request, res: Response) => {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }
    const client = getClient(apiKey);
    res.type('text/plain').send(client.printSavings());
  });

  // Main endpoint: chat completions
  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req) || options.apiKey;
    if (!apiKey) {
      res.status(401).json({
        error: {
          message: 'Missing API key. Pass via Authorization: Bearer <key> or start proxy with --api-key.',
          type: 'authentication_error',
        },
      });
      return;
    }

    try {
      const client = getClient(apiKey);
      if (req.body.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const stream = await client.chat.completions.create({ ...req.body, stream: true });
        for await (const chunk of stream as AsyncIterable<any>) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const result = await client.chat.completions.create(req.body);
      res.json(result);
    } catch (err: any) {
      const status = err?.status || 500;
      res.status(status).json({
        error: {
          message: err?.message || 'Internal proxy error',
          type: err?.type || 'proxy_error',
        },
      });
    }
  });

  // Models endpoint (pass-through)
  app.get('/v1/models', async (req: Request, res: Response) => {
    const apiKey = extractApiKey(req) || options.apiKey;
    if (!apiKey) {
      res.status(401).json({ error: 'Missing API key' });
      return;
    }
    try {
      const client = getClient(apiKey);
      const models = await client.getOpenAI().models.list();
      res.json(models);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // Catch-all for unhandled routes
  app.all('/{*path}', (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: 'TokenWise proxy: endpoint not supported. Supported: POST /v1/chat/completions, GET /v1/models, GET /v1/tokenwise/savings, GET /dashboard',
        type: 'not_found',
      },
    });
  });

  return {
    app,
    start: () => {
      return new Promise<void>((resolve) => {
        app.listen(port, () => {
          console.log(`
╔══════════════════════════════════════════╗
║         TokenWise Proxy v0.1.0          ║
║     "Spend less, agent more."           ║
╠══════════════════════════════════════════╣
║  Listening on: http://localhost:${String(port).padEnd(9)}║
║                                          ║
║  Usage: set base_url to                  ║
║    http://localhost:${String(port).padEnd(21)}║
║                                          ║
║  Endpoints:                              ║
║    POST /v1/chat/completions             ║
║    GET  /v1/models                       ║
║    GET  /v1/tokenwise/savings            ║
║    GET  /v1/tokenwise/report             ║
║    GET  /dashboard                       ║
╚══════════════════════════════════════════╝
`);
          resolve();
        });
      });
    },
    getClients: () => clients,
  };
}

function extractApiKey(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return undefined;
}
