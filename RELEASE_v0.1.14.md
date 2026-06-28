# v0.1.14 Release Notes

## Bug Fixes

- **Fix dataviewjs `container.createEl is not a function`** — Expanded dv.* proxy to intercept `span`, `el`, `paragraph`, `list`, `output` methods, capturing their text output instead of attempting DOM creation in the headless HTTP rendering context. DataviewJS code using `dv.span()`, `dv.el()`, `dv.paragraph()`, `dv.list()`, or `dv.output()` now works correctly via the REST API.

## Improvements

- **HTTP Server binds to `0.0.0.0`** — Changed from `127.0.0.1` to `0.0.0.0`, allowing WSL/Linux environments running alongside Obsidian on Windows to access the REST API via the Windows host IP or WSL vEthernet gateway.

- **MCP Server WSL auto-detection** — The MCP stdio server (`mcp-server.js`) now automatically detects WSL environments and tries the Windows host IP (via default gateway, DNS nameserver, or PowerShell LAN IP query) as a fallback if `127.0.0.1` is unreachable.

## Files Changed

- `src/services/renderService.ts` — Expanded dv.* proxy handlers
- `src/services/apiService.ts` — Changed bind address to `0.0.0.0`
- `src/mcp-server.ts` — Added WSL host auto-detection
- `eslint.config.mjs` — Added mcp-server.ts to ignores
- `manifest.json`, `package.json`, `versions.json`, `README.md` — Version bump
