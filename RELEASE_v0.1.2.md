# Render API v0.1.2

[English](#english) | [中文](#chinese)

---

## English

**Release Date:** 2026-06-27

### Fixes

1. **Obsidian Plugin Review Compliance** — Fixed all linter issues flagged by the Obsidian community plugin review:
   - Replaced inline CSS styles with CSS classes (`no-static-styles-assignment`)
   - Replaced `createEl("h2")` with `new Setting(...).setHeading()`
   - Removed all `any` type casts, replaced with `Record<string, unknown>` and typed interfaces
   - Replaced `document.createElement` with proper Obsidian API
   - Replaced `setTimeout()`/`requestAnimationFrame()` with `window.*` variants for popout window compatibility
   - Removed unused imports and variables

### Release Assets

- `dist/main.js` - Plugin main program
- `dist/manifest.json` - Plugin manifest
- `dist/styles.css` - Plugin styles

---

## Chinese / 中文

**发布日期：** 2026-06-27

### 修复

1. **Obsidian 插件审核合规** — 修复审核标记的所有 lint 问题：
   - 将内联 CSS 样式替换为 CSS 类
   - 将 `createEl("h2")` 替换为 `new Setting(...).setHeading()`
   - 移除所有 `any` 类型，替换为 `Record<string, unknown>` 和类型接口
   - 替换 `document.createElement` 为正确 API
   - 替换 `setTimeout()`/`requestAnimationFrame()` 为 `window.*` 变体（弹窗兼容）
   - 移除未使用的导入和变量

### 发布附件

- `dist/main.js` - 插件主程序
- `dist/manifest.json` - 插件清单
- `dist/styles.css` - 插件样式
