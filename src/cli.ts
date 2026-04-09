#!/usr/bin/env node
/**
 * TokenWise CLI
 *
 * Commands:
 *   tokenwise proxy [--port 8787] [--api-key KEY] [--verbose]
 */

import { createProxyServer } from './proxy/server';

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  if (!command || command === 'help' || command === '--help') {
    console.log(`
TokenWise — Spend less, agent more.

Usage:
  tokenwise proxy [options]    Start the optimization proxy server
  tokenwise help               Show this help

Proxy Options:
  --port <number>     Port to listen on (default: 8787)
  --api-key <key>     Default OpenAI API key
  --verbose           Enable verbose logging

Examples:
  tokenwise proxy --port 8787
  tokenwise proxy --api-key sk-... --verbose

Then use in your code:
  const openai = new OpenAI({ baseURL: 'http://localhost:8787/v1' });
`);
    return;
  }

  if (command === 'proxy') {
    const port = parseInt(getFlag('port') || '8787', 10);
    const apiKey = getFlag('api-key') || process.env.OPENAI_API_KEY;
    const verbose = hasFlag('verbose');

    const server = createProxyServer({ port, apiKey, verbose });
    await server.start();
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "tokenwise help" for usage.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
