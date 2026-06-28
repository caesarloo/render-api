# v0.1.16 Release Notes

## Bug Fixes

- **Fix `JSON.parse` type safety** (`mcp-server.ts:93-94`) — Added `as { status?: string }` type assertion to eliminate `@typescript-eslint/no-unsafe-assignment` and `no-unsafe-member-access` warnings.

- **Fix async event listener** (`RenderApiSettingTab.ts:21-42`) — Wrapped `addEventListener` callback in `void` IIFE to avoid "Promise returned in function argument where a void return was expected" warning.

- **Suppress `display()` deprecation** (`RenderApiSettingTab.ts:65`) — Added `@ts-ignore` with `eslint-disable-next-line @typescript-eslint/ban-ts-comment` to suppress the TypeScript deprecation warning while maintaining backward compatibility with Obsidian <1.13.0.

## Features

- **MCP Server self-distribution** — `mcp-server.js` is now embedded inside `main.js` at build time. On plugin load, the plugin writes it to `.obsidian/plugins/render-api/mcp-server.js` automatically. Users who install from the Obsidian community marketplace will now have the MCP server file available without needing to download it from GitHub Releases.

## Chores

- All ESLint warnings/errors resolved: **0 errors, 15 warnings** (all pre-existing test file warnings)
- `esbuild.config.mjs` reordered: MCP server built first, then injected into main bundle
