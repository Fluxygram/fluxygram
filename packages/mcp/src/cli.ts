#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { createServer } from './server';

/**
 * Fluxygram MCP over stdio: one JSON-RPC message per line in, one per line out.
 *   npx -y @fluxygram/mcp
 * Optional: FLUXYGRAM_ORIGIN to open links on another site (for example a local dev server).
 */
const server = createServer({ origin: process.env.FLUXYGRAM_ORIGIN });
const lines = createInterface({ input: process.stdin });
const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);

lines.on('line', async (line) => {
  if (!line.trim()) return;
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const batch = Array.isArray(message);
  const replies = (await Promise.all((batch ? (message as unknown[]) : [message]).map((m) => server.handle(m)))).filter((r) => r !== undefined);
  if (replies.length) send(batch ? replies : replies[0]);
});
lines.on('close', () => process.exit(0));
