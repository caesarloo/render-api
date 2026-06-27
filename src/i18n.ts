type Lang = "zh" | "en";

const strings: Record<string, Record<Lang, string>> = {
  "plugin.name": { zh: "Render API", en: "Render API" },
  "setting.serverPort": { zh: "服务器端口", en: "Server Port" },
  "setting.serverPort.desc": { zh: "REST API 服务监听端口", en: "REST API server listen port" },
  "setting.enableServerOnStart": { zh: "启动时开启服务", en: "Start Server on Launch" },
  "setting.enableServerOnStart.desc": { zh: "Obsidian 启动时自动启动 API 服务", en: "Auto-start the API server when Obsidian launches" },
  "setting.enableDataview": { zh: "启用 Dataview 渲染", en: "Enable Dataview Rendering" },
  "setting.enableDataview.desc": { zh: "允许执行 dataview 查询和 dataviewjs 代码", en: "Allow executing dataview queries and dataviewjs code" },
  "setting.enableMarkdownRender": { zh: "启用 Markdown 渲染", en: "Enable Markdown Rendering" },
  "setting.enableMarkdownRender.desc": { zh: "允许渲染一般 Markdown 内容（包含 Tasks 等插件）", en: "Allow rendering general markdown content (including Tasks etc.)" },
  "setting.apiKey": { zh: "API 密钥", en: "API Key" },
  "setting.apiKey.desc": { zh: "留空则无需认证。设置后请求需带 X-API-Key 头", en: "Leave empty for no auth. When set, requests need X-API-Key header" },
  "setting.corsOrigin": { zh: "CORS 来源", en: "CORS Origin" },
  "setting.corsOrigin.desc": { zh: "留空则允许所有来源（*）", en: "Leave empty to allow all origins (*)" },
  "setting.serverStatus": { zh: "服务器状态", en: "Server Status" },
  "server.running": { zh: "运行中", en: "Running" },
  "server.stopped": { zh: "已停止", en: "Stopped" },
  "server.start": { zh: "启动服务", en: "Start Server" },
  "server.stop": { zh: "停止服务", en: "Stop Server" },
  "server.portUnavailable": { zh: "端口 {port} 被占用，请更换端口", en: "Port {port} is in use, please change port" },
  "server.startError": { zh: "启动服务器失败：{error}", en: "Failed to start server: {error}" },
  "cmd.startServer": { zh: "启动 Render API 服务", en: "Start Render API Server" },
  "cmd.stopServer": { zh: "停止 Render API 服务", en: "Stop Render API Server" },
  "cmd.openSettings": { zh: "打开 Render API 设置", en: "Open Render API Settings" },
  "render.dataviewDisabled": { zh: "Dataview 插件未启用或未安装", en: "Dataview plugin not enabled or not installed" },
  "render.queryError": { zh: "查询执行失败：{error}", en: "Query execution failed: {error}" },
  "render.fileNotFound": { zh: "文件未找到：{path}", en: "File not found: {path}" },
  "render.renderError": { zh: "渲染失败：{error}", en: "Render failed: {error}" },
};

export function t(key: string, lang: Lang = "zh"): string {
  return strings[key]?.[lang] ?? key;
}
