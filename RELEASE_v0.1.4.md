# Render API v0.1.4

[English](#english) | [中文](#chinese)

---

## English

**Release Date:** 2026-06-27

### Fixes

1. **Review Lint Round 3** — Final remaining review warnings:
   - Explicit cast for `JSON.parse()` return value to avoid unsafe assignment warning
   - Use `activeDocument` directly without `document` fallback for popout window compatibility
   - Suppressed `display` deprecation warning with eslint-comment (required for 1.7.2+)

### Release Assets

- `dist/main.js` - Plugin main program
- `dist/manifest.json` - Plugin manifest
- `dist/styles.css` - Plugin styles

---

## Chinese / 中文

**发布日期：** 2026-06-27

### 修复

1. **审核 Lint 第三轮** — 修复剩余审核警告：
   - `JSON.parse()` 返回值显式类型转换
   - 直接使用 `activeDocument`，移除 `document` 回退
   - 用 eslint 注释抑制 `display` 弃用警告（1.7.2+ 需要）

### 发布附件

- `dist/main.js` - 插件主程序
- `dist/manifest.json` - 插件清单
- `dist/styles.css` - 插件样式
