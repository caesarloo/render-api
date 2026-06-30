# v0.2.0 Release Notes

## New Features

- **SSE/URL MCP transport mode** — Optional SSE-based MCP transport (default: stdio). Configure via plugin settings → MCP Transport. Hermes config simplifies to `url: http://localhost:27123/mcp` with no separate `mcp-server.js` process.
- **Shared MCP protocol logic** — MCP protocol handling extracted to `mcpProtocol.ts`, shared between stdio and SSE modes.

## Bug Fixes

- **mcp-server.js parameter parsing** — Fixed `--port` missing bug where `args.indexOf("--port")` returned -1, causing `args[0]` to be parsed as port (NaN). Now checks index first, defaults to 27123.
- **WSL gateway IP auto-discovery** — `resolveWSLHosts()` now dynamically reads `/proc/net/route` to detect the default gateway instead of relying on a hardcoded list of `172.17.*.*` IPs. Falls back to the hardcoded list on failure.
- **render_file Chinese path** — Chinese-character file paths now render correctly (confirmed working with multiple test files).

## Infrastructure

- ESLint: replaced `require("node:fs")` with top-level `import * as fs` to fix eslint `no-require-imports` violation.
