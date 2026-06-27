# Render API v0.1.5

[English](#english) | [中文](#chinese)

---

## English

**Release Date:** 2026-06-27

### Changes

1. **Unit Tests** — Added comprehensive test suite with Jest (30+ test cases):
   - i18n: locale string resolution
   - Types: default settings and request/response validation
   - RenderService: dataview DQL/JS execution, markdown rendering, file rendering, error handling, XSS prevention
   - ApiServer: lifecycle, health endpoint, CORS, 404 handling, auth

2. **CI Workflow** — Pull request and push checks run typecheck + lint + test + build

3. **Setting Tab Migration** — Fully migrated to `getSettingDefinitions()` API (Obsidian 1.13+), removing deprecated `display()` method

### Release Assets

- `dist/main.js` - Plugin main program
- `dist/manifest.json` - Plugin manifest
- `dist/styles.css` - Plugin styles

---

## Chinese / 中文

**发布日期：** 2026-06-27

### 变更

1. **单元测试** — 使用 Jest 添加了全面的测试套件（30+ 测试用例）
2. **CI 工作流** — PR 和推送时自动运行 typecheck + lint + test + build
3. **设置面板迁移** — 完全迁移到 `getSettingDefinitions()` API，移除已弃用的 `display()` 方法

### 发布附件

- `dist/main.js` - 插件主程序
- `dist/manifest.json` - 插件清单
- `dist/styles.css` - 插件样式
