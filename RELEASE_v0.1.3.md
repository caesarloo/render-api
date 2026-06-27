# Render API v0.1.3

[English](#english) | [中文](#chinese)

---

## English

**Release Date:** 2026-06-27

### Changes

1. **Lint Cleanup Round 2** — Resolved remaining Obsidian review warnings:
   - Removed `any` type casts in API service (unsafe assignment/argument/return)
   - Added typed `_component` property to `RenderApiPlugin` interface
   - Added `toJsonObject()` helper for type-safe JSON serialization
   - Replaced `document` with `activeDocument` for popout window compatibility
   - Removed unused `catch` variable

### Release Assets

- `dist/main.js` - Plugin main program
- `dist/manifest.json` - Plugin manifest
- `dist/styles.css` - Plugin styles

---

## Chinese / 中文

**发布日期：** 2026-06-27

### 变更

1. **Lint 清理第二轮** — 解决剩余 Obsidian 审核警告：
   - 移除 API 服务中的 `any` 类型转换
   - 在 `RenderApiPlugin` 接口中添加类型化的 `_component` 属性
   - 添加 `toJsonObject()` 帮助函数用于类型安全 JSON 序列化
   - 替换 `document` 为 `activeDocument` 以兼容弹窗
   - 移除未使用的 `catch` 变量

### 发布附件

- `dist/main.js` - 插件主程序
- `dist/manifest.json` - 插件清单
- `dist/styles.css` - 插件样式
