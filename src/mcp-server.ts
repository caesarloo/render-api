/**
 * MCP stdio server for Render API
 *
 * Connects to the running Obsidian Render API plugin via HTTP
 * and exposes its capabilities as MCP tools.
 *
 * Usage:
 *   node dist/mcp-server.js [--port 27123] [--host 127.0.0.1]
 *
 * The server auto-detects the Render API port if the specified
 * port is not available. It scans ports 27123-27133.
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
const CLI_PORT = parseInt(args[args.indexOf("--port") + 1] ?? "27123", 10);
const HOST = args[args.indexOf("--host") + 1] ?? "127.0.0.1";

// Discovered base URL — updated after port scan
let activeBaseUrl = `http://${HOST}:${CLI_PORT}`;
let detectedPort: number | null = null;

// ---- HTTP helpers ----

function apiGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(`${activeBaseUrl}${path}`, { timeout: 5_000 }, (res) => {
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

function apiPost(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `${activeBaseUrl}${path}`,
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

/** Check if the Render API is reachable on a given port. */
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/health`, { timeout: 2_000 }, (res) => {
      let chunks = "";
      res.on("data", (chunk: string) => (chunks += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(chunks);
          resolve(data?.status === "running");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2_000, () => { req.destroy(); resolve(false); });
  });
}

/** Scan port range to find the Render API server. */
async function detectServer(host: string, preferred: number): Promise<number | null> {
  const start = Math.max(preferred - 5, 1024);
  const end = preferred + 5;

  // Try preferred port first
  if (await checkPort(host, preferred)) {
    return preferred;
  }

  // Scan range
  process.stderr.write(`[render-api-mcp] Port ${preferred} not available, scanning ${start}-${end}...\n`);
  for (let port = start; port <= end; port++) {
    if (port === preferred) continue;
    if (await checkPort(host, port)) {
      process.stderr.write(`[render-api-mcp] Found Render API on port ${port}\n`);
      return port;
    }
  }
  return null;
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
        code: { type: "string", description: "DataviewJS code" },
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
    case "initialize": {
      sessionInitialized = true;
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "render-api-mcp",
          version: "0.1.13",
        },
      });
      break;
    }

    case "notifications/initialized": {
      break;
    }

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
async function main(): Promise<void> {
  // Dynamic port detection
  detectedPort = await detectServer(HOST, CLI_PORT);
  if (detectedPort) {
    activeBaseUrl = `http://${HOST}:${detectedPort}`;
    try {
      const health = await apiGet("/health") as Record<string, unknown>;
      process.stderr.write(`[render-api-mcp] Connected to Render API v${health.version ?? "unknown"} at ${HOST}:${detectedPort}\n`);
    } catch {
      process.stderr.write(`[render-api-mcp] Connected to Render API at ${HOST}:${detectedPort}\n`);
    }
  } else {
    process.stderr.write(`[render-api-mcp] Warning: Render API not found on ports ${Math.max(CLI_PORT - 5, 1024)}-${CLI_PORT + 5}. Start the plugin server first.\n`);
  }

  process.stderr.write(`[render-api-mcp] MCP server ready (stdio)\n`);

  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      void handleRequest(req);
    } catch {
      process.stderr.write(`[render-api-mcp] Failed to parse request: ${trimmed}\n`);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

void main();
