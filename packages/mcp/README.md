# @fluxygram/mcp

[Fluxygram](https://fluxygram.app) MCP server: lets your AI agent write, validate and share animated, step-by-step diagrams.

| Tool | What it does |
| --- | --- |
| `get_guide` | The Fluxygram format and storytelling rules |
| `get_example` | A complete example diagram to adapt |
| `validate_diagram` | Checks the diagram and lists every problem |
| `share_link` | A fluxygram.app link to watch, edit or present it (nothing is uploaded) |

## Use it

Remote, nothing to install: `https://fluxygram.app/mcp`

```sh
claude mcp add --transport http fluxygram https://fluxygram.app/mcp
```

Local, over stdio:

```json
{ "mcpServers": { "fluxygram": { "command": "npx", "args": ["-y", "@fluxygram/mcp"] } } }
```

Setup for Claude Desktop, Cursor, VS Code, Windsurf and Codex: https://docs.fluxygram.app/guides/mcp/

## In your own server

```js
import { handleHttp } from '@fluxygram/mcp';
export default { fetch: (req) => handleHttp(req) }; // Cloudflare Workers, Deno, Bun…
```
