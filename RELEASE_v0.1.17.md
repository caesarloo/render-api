# v0.1.17 Release Notes

## Changes

- **Removed `fs` / `child_process`** — WSL detection now uses environment variable `process.env.WSL_DISTRO_NAME` instead of `fs.readFileSync` + `child_process.execSync`. Eliminates community plugin review warnings for Direct Filesystem Access and Shell Execution.
- **Replaced `display()` with `getSettingDefinitions()`** — Extracted settings UI into `renderSettings()` private method. `display()` kept for backward compat with Obsidian <1.13.0. New `getSettingDefinitions()` uses the modern API.
- **Moved MCP server code** — `src/mcp-server.ts` deleted, merged into `src/mcp-server-core.ts` (no obsidian dependency, clean module for both CLI and embedding).
- **Fixed eslint-disable description** — Added `-- description` to `@typescript-eslint/ban-ts-comment` directive for community plugin review compliance.
