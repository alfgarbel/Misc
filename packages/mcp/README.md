# ogsmith-mcp

An [MCP](https://modelcontextprotocol.io) server for [OGsmith](https://ogsmith.app), so Claude or any MCP client can design Open Graph social cards in conversation: render one, look at it, change the template or colour, render again, and save the PNG.

## Tools

| Tool | What it does |
| ---- | ------------ |
| `render_card` | Renders a card, saves the PNG, shows it, and returns the `og:image` URL and meta tag. |
| `list_options` | Built-in templates, sizes and themes. |
| `get_usage` | Plan, renders used this month, remaining. |
| `create_batch` | Renders many cards at once. |
| `list_batches`, `get_batch` | Batch progress and per-row errors. |
| `download_batch` | Saves a finished batch as a zip. |

## Setup

Get an API key from the [OGsmith dashboard](https://ogsmith.app/dashboard). Without one, renders are the watermarked demo and the account tools are off.

**Claude Code**

```bash
claude mcp add ogsmith -e OGSMITH_API_KEY=og_... -- npx -y ogsmith-mcp
```

**Claude Desktop** (Settings → Developer → Edit config)

```json
{
  "mcpServers": {
    "ogsmith": {
      "command": "npx",
      "args": ["-y", "ogsmith-mcp"],
      "env": { "OGSMITH_API_KEY": "og_..." }
    }
  }
}
```

| Variable | Default |
| -------- | ------- |
| `OGSMITH_API_KEY` | none |
| `OGSMITH_OUTPUT_DIR` | `~/OGsmith` |
| `OGSMITH_URL` | `https://ogsmith.app` |

Then ask things like "make an OG card for my post 'Shipping v2' in the split template and save it".
