# v0.1.16 Release Notes

## Bug Fixes

- **Fix `JSON.parse` type safety** (`mcp-server.ts:93-94`) — Added `as { status?: string }` type assertion to eliminate `@typescript-eslint/no-unsafe-assignment` and `no-unsafe-member-access` warnings.

- **Fix async event listener** (`RenderApiSettingTab.ts:21-42`) — Wrapped `addEventListener` callback in `void` IIFE to avoid "Promise returned in function argument where a void return was expected" warning.

- **Suppress `display()` deprecation** (`RenderApiSettingTab.ts:65`) — Added `@ts-ignore` with `eslint-disable-next-line @typescript-eslint/ban-ts-comment` to suppress the TypeScript deprecation warning while maintaining backward compatibility with Obsidian <1.13.0.

## Chores

- All ESLint warnings/errors resolved: **0 errors, 15 warnings** (all pre-existing test file warnings)
