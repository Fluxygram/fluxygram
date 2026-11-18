import { validate, type Diagram, type Locale } from '@fluxygram/core';
import { EXAMPLES, GUIDE, SUMMARIES, VERSION } from './data';

/**
 * Fluxygram MCP server: a tiny, dependency-free JSON-RPC core that speaks the Model Context Protocol.
 * The same core runs over stdio (`npx @fluxygram/mcp`) and over HTTP (fluxygram.app/mcp, a Worker).
 *
 * Tools: get_guide, get_example, validate_diagram, share_link. The diagram itself is written by the
 * user's own agent; this server only teaches the format, checks it and turns it into a link.
 */

// La versión sale del package.json (la escribe scripts/data.mjs en data.ts).
export { VERSION };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export interface ServerOptions {
  /** Site that opens the links. Default https://fluxygram.app */
  origin?: string;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const INSTRUCTIONS = `Fluxygram turns a small JSON file (.flux.json) into an animated diagram that explains something step by step.
Workflow: call get_guide once to learn the format (and get_example for a model to copy), write the diagram JSON, call validate_diagram and fix every issue, then call share_link and give the user the link so they can watch it. Write labels and captions in the user's language.`;

const TOOLS = [
  {
    name: 'get_guide',
    title: 'Fluxygram format guide',
    description:
      'How to write a Fluxygram diagram: the seven diagram types and when to use each, nodes, edges, steps with captions, motion, live status (tracker mode), icons and the storytelling rules. Call it before writing your first diagram.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_example',
    title: 'Get an example diagram',
    description:
      'Returns a complete example diagram to learn from or adapt. Without a name, lists the available examples (recipes, software architecture, OAuth login, order process, timelines, live order trackers and more).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Example name from the list, for example "sequence" or "tracker". Omit to list them.' },
        lang: { type: 'string', enum: ['en', 'es'], description: 'Language of the labels. Default en.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'validate_diagram',
    title: 'Validate a diagram',
    description:
      'Checks a Fluxygram diagram with the same validator the viewer uses. Returns "valid" with a short summary, or every problem with its path so you can fix it. Always validate before sharing.',
    inputSchema: {
      type: 'object',
      properties: {
        diagram: { type: ['object', 'string'], description: 'The diagram: the JSON object or its text.' },
        lang: { type: 'string', enum: ['en', 'es'], description: 'Language of the error messages. Default en.' },
      },
      required: ['diagram'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'share_link',
    title: 'Get a link to watch the diagram',
    description:
      'Validates the diagram and returns links on fluxygram.app to watch it animated, open it in the editor or present it full screen. The diagram travels inside the link (compressed); nothing is uploaded or stored. Give the view link to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        diagram: { type: ['object', 'string'], description: 'The diagram: the JSON object or its text.' },
      },
      required: ['diagram'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

function parseDiagram(input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof input !== 'string') return { ok: true, value: input };
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (err) {
    return { ok: false, error: `The diagram is not valid JSON: ${(err as Error).message}` };
  }
}

function check(input: unknown, locale: Locale): { ok: true; diagram: Diagram } | { ok: false; result: ToolResult } {
  const parsed = parseDiagram(input);
  if (!parsed.ok) return { ok: false, result: text(parsed.error, true) };
  const result = validate(parsed.value, { locale });
  if (!result.ok) {
    const lines = result.issues.map((i) => `- ${i.path || '(root)'}: ${i.message}`);
    return { ok: false, result: text(`The diagram has ${result.issues.length} problem(s). Fix them and validate again:\n${lines.join('\n')}`, true) };
  }
  return { ok: true, diagram: result.diagram };
}

function summary(d: Diagram) {
  const parts = [`type ${d.type}`, `${d.nodes.length} nodes`, `${d.edges?.length ?? 0} edges`, `${d.steps?.length ?? 0} steps`];
  const tips: string[] = [];
  if (!d.title) tips.push('Add a "title": it is shown above the diagram and used as its name.');
  if (d.type !== 'timeline' && (d.steps?.length ?? 0) === 0) tips.push('Consider "steps" with captions: they are what makes the diagram explain something.');
  if (d.nodes.length > 14) tips.push(`${d.nodes.length} nodes is a lot for one diagram; consider splitting it.`);
  return { parts: parts.join(', '), tips };
}

/* ---------- Links: same encoding as the site (deflate-raw + base64url in #d=) ---------- */

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function encodeDiagram(d: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(d));
  const out = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(new Uint8Array(await new Response(out).arrayBuffer()));
}

/* ---------- Tools ---------- */

async function callTool(name: string, args: Record<string, unknown>, origin: string): Promise<ToolResult> {
  const locale: Locale = args.lang === 'es' ? 'es' : 'en';
  switch (name) {
    case 'get_guide':
      return text(
        GUIDE.replace(/`\/schema\/v1\.json`/g, `\`${origin}/schema/v1.json\``) +
          `\n\n## With this MCP server\n\nUse get_example instead of the examples folder. When the diagram is ready: validate_diagram, fix every issue, then share_link and give the user the view link.`,
      );
    case 'get_example': {
      const exName = typeof args.name === 'string' ? args.name.trim() : '';
      if (!exName) {
        const list = SUMMARIES.map((s) => `- ${s.name}${s.live ? ' (live tracker)' : ''}: ${s.about}`);
        return text(`Available examples (call get_example with a name):\n${list.join('\n')}`);
      }
      const d = EXAMPLES[locale][exName];
      if (!d) return text(`There is no example called "${exName}". Call get_example without a name to list them.`, true);
      const live = SUMMARIES.find((s) => s.name === exName)?.live;
      const note = live ? '\n\nThis is a live status diagram: show it with mode="tracker" and stage="<node id>" (see "Live status" in get_guide).' : '';
      return text(JSON.stringify(d, null, 2) + note);
    }
    case 'validate_diagram': {
      const r = check(args.diagram, locale);
      if (!r.ok) return r.result;
      const s = summary(r.diagram);
      return text(`Valid: ${s.parts}.${s.tips.length ? `\nSuggestions:\n${s.tips.map((t) => `- ${t}`).join('\n')}` : ''}`);
    }
    case 'share_link': {
      const r = check(args.diagram, locale);
      if (!r.ok) return r.result;
      const code = await encodeDiagram(r.diagram);
      return text(
        [
          `Watch: ${origin}/view#d=${code}`,
          `Edit a copy: ${origin}/play#d=${code}`,
          `Present full screen: ${origin}/present#d=${code}`,
          '',
          'Give the user the Watch link. From there they can edit it, export a GIF or video, or embed it on a site.',
        ].join('\n'),
      );
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

/** Creates the server. `handle` takes one parsed JSON-RPC message and returns the response (or nothing for notifications). */
export function createServer(options: ServerOptions = {}) {
  const origin = (options.origin ?? 'https://fluxygram.app').replace(/\/$/, '');

  async function dispatch(req: RpcRequest): Promise<Json> {
    const params = req.params ?? {};
    switch (req.method) {
      case 'initialize': {
        const asked = String(params.protocolVersion ?? '');
        return {
          protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0]!,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'fluxygram', title: 'Fluxygram', version: VERSION, websiteUrl: origin },
          instructions: INSTRUCTIONS,
        };
      }
      case 'ping':
        return {};
      case 'tools/list':
        return { tools: TOOLS } as unknown as Json;
      case 'tools/call': {
        const name = String(params.name ?? '');
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        return (await callTool(name, args, origin)) as unknown as Json;
      }
      default:
        throw new RpcError(-32601, `Method not found: ${req.method}`);
    }
  }

  async function handle(message: unknown): Promise<Json | undefined> {
    const req = message as RpcRequest;
    if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } };
    }
    const isNotification = req.id === undefined;
    try {
      const result = await dispatch(req);
      return isNotification ? undefined : { jsonrpc: '2.0', id: req.id ?? null, result };
    } catch (err) {
      if (isNotification) return undefined;
      const code = err instanceof RpcError ? err.code : -32603;
      return { jsonrpc: '2.0', id: req.id ?? null, error: { code, message: (err as Error).message } };
    }
  }

  return { handle };
}

/* ---------- Streamable HTTP (stateless, JSON responses): for Workers and any fetch-style server ---------- */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

/** Handles an MCP request over HTTP. Mount it on a route such as /mcp. */
export async function handleHttp(request: globalThis.Request, options: ServerOptions = {}): Promise<Response> {
  const req = request;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    // No server-to-client stream: this server never sends requests of its own.
    return new Response('Fluxygram MCP server. Connect an MCP client to this URL (POST, JSON-RPC).', {
      status: 405,
      headers: { ...CORS, Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS });
  }
  const server = createServer(options);
  const batch = Array.isArray(body);
  const replies = (await Promise.all((batch ? (body as unknown[]) : [body]).map((m) => server.handle(m)))).filter((r) => r !== undefined);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: CORS });
}
