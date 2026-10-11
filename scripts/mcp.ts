/**
 * OGsmith as an MCP server, so Claude (Desktop, Code, or any MCP client) can
 * render and iterate on cards in conversation.
 *
 *   OGSMITH_URL=https://your-domain OGSMITH_API_KEY=og_... npm run mcp
 *
 * It speaks MCP over stdio: the client starts it, nothing listens on a port.
 * See "Using OGsmith from Claude (MCP)" in the README for client setup.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOgsmithMcpServer } from "../src/lib/mcp/server";

const server = createOgsmithMcpServer({
  baseUrl:
    process.env.OGSMITH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiKey: process.env.OGSMITH_API_KEY,
  outputDir: process.env.OGSMITH_OUTPUT_DIR ?? join(homedir(), "OGsmith"),
});

server.connect(new StdioServerTransport()).catch((err) => {
  // stdout is the protocol channel, so diagnostics go to stderr.
  console.error("OGsmith MCP server failed to start:", err);
  process.exit(1);
});
