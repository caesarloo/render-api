# v0.1.17 Release Notes

## Fixes

- **Fix community plugin review ERROR** (`RenderApiSettingTab.ts:48`) — Added description to `eslint-disable-next-line @typescript-eslint/ban-ts-comment` directive explaining why `@ts-ignore` is required over `@ts-expect-error` (deprecation warnings are suppressed by `@ts-ignore` but not `@ts-expect-error`).
