# Render API

[English](#english) | [中文](#chinese)

---

## English

**Render API** is a desktop-only Obsidian plugin that exposes dataview, Tasks, and general markdown rendering results via a local REST API. It allows AI tools — such as Hermes Agent, Claude Code, or custom scripts — to programmatically access your vault's rendered content.

> ⚠️ **Permissions**: This plugin starts a local HTTP server (Node.js `http` module, bound to `127.0.0.1`) and may invoke the dataview plugin's JavaScript API when enabled. It does not access external networks beyond what you configure. These permissions are required to expose rendering results via an API and cannot be replaced by the Obsidian vault API.

**Current stable version**: `0.1.11`

**Latest release**: https://github.com/caesarloo/render-api/releases

### Features

- **REST API server** — lightweight HTTP server (zero external dependencies)
- **Dataview DQL queries** — execute `TABLE ... FROM ...` queries and return JSON/HTML/text results
- **DataviewJS execution** — run arbitrary `dv.*` code and capture output
- **File rendering** — render any vault file by path, including all post-processor output
- **Markdown rendering** — render arbitrary markdown strings with full Obsidian pipeline support
- **Output formats** — HTML, plain text, or structured JSON
- **Configurable auth** — optional API key via `X-API-Key` header
- **CORS support** — configure allowed origins for cross-origin requests

### Installation

1. Go to the [latest release page](https://github.com/caesarloo/render-api/releases) and download these 3 files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. Create the plugin directory inside your vault: `<Vault>/.obsidian/plugins/render-api/`
3. Copy the 3 downloaded files into that directory.
4. Restart Obsidian, or reload Community Plugins in Settings.

### Prerequisites

- **Desktop Obsidian only** (not available on mobile).
- **Dataview plugin** (optional, for DQL/DataviewJS support).
- **Node.js** — Obsidian's built-in runtime provides everything needed.

### Usage

#### Start the Server

- **Command Palette**: Run `Start Render API Server`
- The server starts on `http://localhost:27123` by default (configurable in settings)

#### API Endpoints

All endpoints return JSON. Set `Content-Type: application/json` for POST requests.

##### `GET /health`

Check server status and capabilities.

```json
{
  "status": "running",
  "port": 27123,
  "dataviewAvailable": true,
  "version": "0.1.11"
}
```

##### `POST /render`

Render arbitrary markdown content or execute dataview queries.

**Request body:**
```json
{
  "content": "# Hello\nThis is **markdown** with `code`.",
  "format": "html"
}
```

```json
{
  "query": "TABLE file.name, file.mtime FROM \"Work\"",
  "format": "json"
}
```

```json
{
  "code": "dv.pages().filter(p => p.tags?.includes('project')).map(p => p.file.name)",
  "format": "text"
}
```

```json
{
  "filePath": "Daily/2026-06-27.md",
  "format": "html"
}
```

**Response:**
```json
{
  "success": true,
  "html": "<h1>Hello</h1>\n<p>This is <strong>markdown</strong> with <code>code</code>.</p>",
  "text": "Hello\nThis is markdown with code.",
  "mimeType": "text/html"
}
```

##### `POST /render/dataview`

Shorthand for dataview-specific requests — same as `/render` with `query` or `code` fields.

##### `GET|POST /render/file`

Render a vault file by path.

**GET:** `/render/file?path=Daily/2026-06-27.md&format=html`

**POST:**
```json
{
  "filePath": "Daily/2026-06-27.md",
  "format": "json"
}
```

#### Authentication

If you configure an API key in settings, all requests must include the `X-API-Key` header:

```
X-API-Key: your-secret-key
```

#### Settings

| Setting | Description |
|---------|-------------|
| Server Port | HTTP server listen port (default: 27123) |
| Start Server on Launch | Auto-start when Obsidian opens |
| Enable Dataview | Allow DQL/DataviewJS execution |
| Enable Markdown Rendering | Allow general markdown rendering |
| API Key | Optional auth key (leave empty for no auth) |
| CORS Origin | Allowed origin for cross-origin requests (empty = `*`) |

### Use Cases

- **AI Agent integration** — Have Hermes Agent or Claude Code query your vault via API
- **Automated reports** — Schedule scripts that fetch rendered dataview tables
- **Dashboard building** — Pull Obsidian content into external dashboards
- **MCP bridge** — The REST API can be wrapped by an MCP stdio gateway

### FAQ

**Q: The server won't start.**
A: Check if port 27123 is already in use. Change the port in settings.

**Q: Dataview queries return errors.**
A: Ensure the Dataview plugin is installed and enabled in Obsidian.

**Q: How do I call this from Hermes Agent?**
A: Use `curl` from your Hermes session:
```bash
curl -s http://localhost:27123/render -H 'Content-Type: application/json' \
  -d '{"query": "TABLE file.name FROM \"\"", "format": "json"}'
```

**Q: Is this secure?**
A: The server binds only to `127.0.0.1` (localhost). Use the API key setting to add auth, and keep the port behind your firewall.

### Development

```bash
# Build the plugin
npm run build

# Type-check
npm run typecheck

# Dev mode with watch
npm run dev
```

### MCP Server

A stdio MCP server (`mcp-server.js`) is included with the plugin. It enables direct integration with AI tools that support the Model Context Protocol, such as Hermes Agent and Claude Desktop.

**MCP tools available:**
- `health` — Check server status
- `render_markdown` — Render markdown content
- `render_file` — Render a vault file by path
- `dataview_query` — Execute Dataview DQL query
- `dataviewjs` — Execute DataviewJS code

**Configuration (Hermes Agent):**
```yaml
mcp_servers:
  render-api:
    command: node
    args:
      - <vault>/.obsidian/plugins/render-api/mcp-server.js
    enabled: true
```

**Configuration (Claude Desktop):**
```json
{
  "mcpServers": {
    "render-api": {
      "command": "node",
      "args": ["<vault>/.obsidian/plugins/render-api/mcp-server.js"]
    }
  }
}
```

---

## Chinese / 中文

# Render API 插件使用说明

**Render API** 是一个 Obsidian **桌面端**插件，将 dataview、Tasks 等插件的渲染结果通过本地 REST API 暴露出来，让 AI 工具（如 Hermes Agent、Claude Code）或自定义脚本程序化地访问你的笔记库渲染内容。

> ⚠️ **权限说明**：本插件启动一个本地 HTTP 服务（Node.js `http` 模块，绑定到 `127.0.0.1`），并可能在你开启相关功能时调用 dataview 插件的 JavaScript API。插件不会主动访问外部网络。这些权限是 API 服务所必需的，无法通过 Obsidian vault API 替代。

当前稳定版本：`0.1.11`

最新发布页：https://github.com/caesarloo/render-api/releases

### 功能清单

- REST API 服务（零外部依赖，内置 Node.js http 模块）
- Dataview DQL 查询（`TABLE ... FROM ...` 等，返回 JSON/HTML/Text）
- DataviewJS 执行（运行 `dv.*` 代码，捕获输出）
- 文件渲染（按路径渲染库内文件，包含全部后处理器输出）
- Markdown 渲染（渲染任意 markdown 字符串，完整 Obsidian 渲染管线）
- 输出格式：HTML / 纯文本 / 结构化 JSON
- 可选 API 密钥认证（`X-API-Key` 请求头）
- CORS 跨域支持

### 安装

1. 打开发布页下载以下 3 个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. 在你的库目录下创建插件目录：`<Vault>/.obsidian/plugins/render-api/`
3. 将上述 3 个文件放入该目录。
4. 重启 Obsidian，或在"社区插件"中重新加载插件。

### 前置条件

- 仅支持桌面端 Obsidian。
- Dataview 插件（可选，用于 DQL/DataviewJS 查询支持）。

### 使用说明

#### 启动服务

- 命令面板执行 `启动 Render API 服务`
- 默认监听 `http://localhost:27123`（可在设置中修改）

#### API 端点

所有端点返回 JSON。POST 请求需设置 `Content-Type: application/json`。

**GET /health** — 健康检查

**POST /render** — 执行查询或渲染内容

请求体示例 — dataview DQL 查询：
```json
{
  "query": "TABLE file.name, file.mtime FROM \"笔记\"",
  "format": "json"
}
```

请求体示例 — dataviewjs 代码：
```json
{
  "code": "dv.pages().filter(p => p.tags?.includes('project')).map(p => p.file.name)",
  "format": "text"
}
```

请求体示例 — 渲染指定文件：
```json
{
  "filePath": "日记/2026-06-27.md",
  "format": "html"
}
```

**GET|POST /render/file** — 按路径渲染库内文件

#### 认证

在设置中配置 API 密钥后，所有请求需带 `X-API-Key` 请求头。

#### 设置项

| 设置 | 说明 |
|------|------|
| 服务器端口 | HTTP 监听端口（默认 27123） |
| 启动时开启服务 | Obsidian 启动时自动启动 |
| 启用 Dataview 渲染 | 允许 DQL/DataviewJS |
| 启用 Markdown 渲染 | 允许一般 Markdown 渲染 |
| API 密钥 | 可选认证密钥（留空免认证） |
| CORS 来源 | 允许的跨域来源（留空为 `*`） |

### 使用场景

- **AI Agent 集成** — 让 Hermes Agent 或 Claude Code 通过 API 读取笔记内容
- **自动化报表** — 定时脚本抓取 dataview 表格结果
- **外部看板** — 将 Obsidian 内容推送到外部仪表盘
- **MCP 桥接** — REST API 可通过 MCP stdio 网关包装，让 AI 工具直接调用

### 常见问题

**服务无法启动？** 检查端口是否被占用，在设置中更换端口。

**Dataview 查询报错？** 确认 Dataview 插件已安装并启用。

**如何在 Hermes Agent 中调用？** 使用 curl：
```bash
curl -s http://localhost:27123/render -H 'Content-Type: application/json' \
  -d '{"query": "TABLE file.name FROM \"\"", "format": "json"}'
```

**安全吗？** 服务仅绑定 `127.0.0.1`（本地回环地址）。建议在设置中添加 API 密钥。

### 开发

```bash
npm run build    # 构建
npm run typecheck  # 类型检查
npm run dev      # 开发模式（watch）
```

### MCP 服务

插件内置 stdio MCP Server（`mcp-server.js`），支持通过 Model Context Protocol 直接集成 AI 工具，无需手动调用 curl。

**可用的 MCP 工具：**
- `health` — 检查服务状态
- `render_markdown` — 渲染 Markdown 内容
- `render_file` — 按路径渲染库内文件
- `dataview_query` — 执行 Dataview DQL 查询
- `dataviewjs` — 执行 DataviewJS 代码

**Hermes Agent 配置：**
```yaml
mcp_servers:
  render-api:
    command: node
    args:
      - <库目录>/.obsidian/plugins/render-api/mcp-server.js
    enabled: true
```

**Claude Desktop 配置：**
```json
{
  "mcpServers": {
    "render-api": {
      "command": "node",
      "args": ["<库目录>/.obsidian/plugins/render-api/mcp-server.js"]
    }
  }
}
```

---

**Repo**: https://github.com/caesarloo/render-api
