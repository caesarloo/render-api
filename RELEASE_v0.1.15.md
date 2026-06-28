# v0.1.15 Release Notes

## Chores

- **Convert `require()` to ESM imports in `mcp-server.ts`** — Replaced `require("node:fs")` and `require("node:child_process")` with proper `import * as fs` / `import * as cp`, eliminating 4 `@typescript-eslint/no-require-imports` errors and all related `no-unsafe-*` warnings for the file.

- **Fix popout window compatibility in `RenderApiSettingTab.ts`** — Changed `setTimeout()` to `window.setTimeout()` and `document.createRange()` to `activeDocument.createRange()` to satisfy Obsidian plugin ESLint rules.

- **Eliminated all ESLint errors** — `0 errors, 15 warnings` (all warnings are pre-existing test file warnings: `no-explicit-any` and `no-unused-vars`, both configured at `warn` level).
