# Render API v0.1.0

[English](#english) | [中文](#chinese)

---

## English

**Release Date:** 2026-06-27

### Initial Release

Render API exposes dataview, Tasks, and general markdown rendering results via a local REST API.

### Features

1. **REST API Server** — lightweight HTTP server (Node.js built-in `http` module, zero external dependencies)
2. **Dataview DQL Queries** — execute `TABLE ... FROM ...` queries and return JSON/HTML/text results
3. **DataviewJS Execution** — run arbitrary `dv.*` code and capture output
4. **File Rendering** — render any vault file by path, including all post-processor output
5. **Markdown Rendering** — render arbitrary markdown strings with full Obsidian pipeline support
6. **Multiple Output Formats** — HTML, plain text, or structured JSON
7. **Configurable Authentication** — optional API key via `X-API-Key` header
8. **CORS Support** — configure allowed origins for cross-origin requests
9. **Settings Tab** — configure port, auth, dataview toggle, auto-start

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check & server info |
| POST | `/render` | Render markdown/dataview/dataviewjs |
| POST | `/render/dataview` | Dataview-specific shorthand |
| GET/POST | `/render/file` | Render vault file by path |

### Release Assets

- `dist/main.js` - Plugin main program
- `dist/manifest.json` - Plugin manifest
- `dist/styles.css` - Plugin styles

---

## Chinese / 中文

**发布日期：** 2026-06-27

### 首个版本发布

Render API 将 dataview、Tasks 等插件的渲染结果通过本地 REST API 暴露出来。

### 功能清单

1. REST API 服务（零外部依赖，内置 Node.js http 模块）
2. Dataview DQL 查询（`TABLE ... FROM ...` 等，返回 JSON/HTML/Text）
3. DataviewJS 执行（运行 `dv.*` 代码，捕获输出）
4. 文件渲染（按路径渲染库内文件）
5. Markdown 渲染（渲染任意 markdown 字符串）
6. 多输出格式（HTML / 纯文本 / 结构化 JSON）
7. 可选 API 密钥认证
8. CORS 跨域支持
9. 设置面板（端口、认证、dataview 开关、自动启动）

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 & 服务信息 |
| POST | `/render` | 渲染 markdown/dataview/dataviewjs |
| POST | `/render/dataview` | Dataview 专用快捷入口 |
| GET/POST | `/render/file` | 按路径渲染库内文件 |

### 发布附件

- `dist/main.js` - 插件主程序
- `dist/manifest.json` - 插件清单
- `dist/styles.css` - 插件样式
