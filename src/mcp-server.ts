/**
 * MCP stdio server for Render API
 *
 * Connects to the running Obsidian Render API plugin via HTTP
 * and exposes its capabilities as MCP tools.
 *
 * Usage:
 *   node dist/mcp-server.js [--port 27123] [--host 127.0.0.1]
 *
 * MCP client config (hermes, claude desktop, etc.):
 *   {
 *     "command": "node",
 *     "args": ["path/to/dist/mcp-server.js"],
 *     "env": {}
 *   }
 */

import * as http from "node:http";
import * as readline from "node:readline";

// ---- Config ----
const args = process.argv.slice(2);
const PORT = parseInt(args[args.indexOf("--port") + 1] ?? "27123", 10);
const HOST = args[args.indexOf("--host") + 1] ?? "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

// ---- HTTP helper ----
function apiPost(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: 30_000,
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk: string) => (chunks += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(chunks));
          } catch {
            resolve(chunks);
          }
        });
      },
    );
    req.on("error", (err) => reject(err));
    req.write(data);
    req.end();
  });
}

function apiGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, { timeout: 5_000 }, (res) => {
      let chunks = "";
      res.on("data", (chunk: string) => (chunks += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(chunks));
        } catch {
          resolve(chunks);
        }
      });
    }).on("error", (err) => reject(err));
  });
}

// ---- MCP Protocol ----
interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for session state tracking in future MCP protocol handshake validation
let sessionInitialized = false;

function sendResponse(id: number | string, result: unknown): void {
  const msg: JsonRpcResponse = { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendError(id: number | string, code: number, message: string): void {
  const msg: JsonRpcResponse = { jsonrpc: "2.0", id, error: { code, message } };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

// ---- Tool definitions ----
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const tools: ToolDefinition[] = [
  {
    name: "health",
    description: "Check if the Render API server is running and healthy",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      return await apiGet("/health");
    },
  },
  {
    name: "render_markdown",
    description: "Render arbitrary markdown content through Obsidian's render pipeline",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Markdown content to render" },
        format: { type: "string", enum: ["html", "text", "json"], description: "Output format (default: html)" },
      },
      required: ["content"],
    },
    handler: async (args) => {
      return await apiPost("/render", {
        content: args.content,
        format: args.format ?? "html",
      });
    },
  },
  {
    name: "render_file",
    description: "Render a vault file by its path within the Obsidian vault",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the file in the vault (e.g. 'Daily/2026-06-27.md')" },
        format: { type: "string", enum: ["html", "text", "json"], description: "Output format (default: html)" },
      },
      required: ["filePath"],
    },
    handler: async (args) => {
      return await apiPost("/render", {
        filePath: args.filePath,
        format: args.format ?? "html",
      });
    },
  },
  {
    name: "dataview_query",
    description: "Execute a Dataview DQL query and return the results",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Dataview DQL query (e.g. 'TABLE file.name, file.mtime FROM \"\"')" },
        format: { type: "string", enum: ["html", "text", "json"], description: "Output format (default: json)" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      return await apiPost("/render/dataview", {
        query: args.query,
        format: args.format ?? "json",
      });
    },
  },
  {
    name: "dataviewjs",
    description: "Execute arbitrary dataviewjs code using the dv.* API",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "DataviewJS code (e.g. 'dv.pages().filter(p => p.tags?.includes(\"project\")).map(p => p.file.name)')" },
        format: { type: "string", enum: ["html", "text", "json"], description: "Output format (default: text)" },
      },
      required: ["code"],
    },
    handler: async (args) => {
      return await apiPost("/render/dataview", {
        code: args.code,
        format: args.format ?? "text",
      });
    },
  },
];

// ---- Request Handler ----
async function handleRequest(req: JsonRpcRequest): Promise<void> {
  const { id, method, params } = req;

  switch (method) {
    // Session management
    case "initialize": {
      sessionInitialized = true;
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "render-api-mcp",
          version: "0.1.11",
        },
      });
      break;
    }

    case "notifications/initialized": {
      // No response needed for notifications
      break;
    }

    // Tools
    case "tools/list": {
      sendResponse(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      break;
    }

    case "tools/call": {
      if (!params || typeof params.name !== "string") {
        sendError(id, -32602, "Invalid params: name is required");
        return;
      }
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) {
        sendError(id, -32601, `Tool not found: ${params.name}`);
        return;
      }
      try {
        const result = await tool.handler((params.arguments ?? {}) as Record<string, unknown>);
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendError(id, -32603, `Tool execution failed: ${msg}`);
      }
      break;
    }

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

// ---- Main ----
function main(): void {
  // Try to connect to the server on startup
  apiGet("/health")
    .then((health) => {
      const info = health as Record<string, unknown>;
      process.stderr.write(`[render-api-mcp] Connected to Render API v${info.version ?? "unknown"} at ${HOST}:${PORT}\n`);
    })
    .catch(() => {
      process.stderr.write(`[render-api-mcp] Warning: Could not connect to Render API at ${HOST}:${PORT}. Make sure the plugin server is running.\n`);
    });

  process.stderr.write(`[render-api-mcp] MCP server ready (stdio)\n`);

  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      void handleRequest(req);
    } catch {
      // Ignore parse errors on malformed JSON
      process.stderr.write(`[render-api-mcp] Failed to parse request: ${trimmed}\n`);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main();
