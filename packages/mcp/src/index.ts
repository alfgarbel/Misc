#!/usr/bin/env node
/**
 * The published entry point: `npx -y ogsmith-mcp`. Same server as
 * scripts/mcp.ts, but pointed at ogsmith.app unless told otherwise.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOgsmithMcpServer } from "../../../src/lib/mcp/server";

const server = createOgsmithMcpServer({
  baseUrl: process.env.OGSMITH_URL ?? "https://ogsmith.app",
  apiKey: process.env.OGSMITH_API_KEY,
  outputDir: process.env.OGSMITH_OUTPUT_DIR ?? join(homedir(), "OGsmith"),
});

server.connect(new StdioServerTransport()).catch((err) => {
  // stdout is the protocol channel, so diagnostics go to stderr.
  console.error("OGsmith MCP server failed to start:", err);
  process.exit(1);
});
