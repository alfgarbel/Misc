import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const dir = join(__dirname, "../packages/mcp");
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
const server = JSON.parse(readFileSync(join(dir, "server.json"), "utf8"));

// The MCP registry rejects a listing whose name or version disagrees with
// the npm package it points at, so a version bump has to touch both.
describe("published MCP package", () => {
  it("agrees with its registry listing", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].identifier).toBe(pkg.name);
    expect(server.packages[0].version).toBe(pkg.version);
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
});
