/**
 * MCP stdio server core for Render API
 *
 * Connects to the running Obsidian Render API plugin via HTTP
 * and exposes its capabilities as MCP tools. No obsidian dependency.
 *
 * Usage:
 *   node dist/mcp-server.js [--port 27123] [--host 127.0.0.1]
 *
 * The server auto-detects the Render API port if the specified
 * port is not available. It scans ports 27123-27133.
 * On WSL, it also tries the Windows host IP automatically.
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
import * as fs from "node:fs";
import {
  handleMcpRequest,
  TOOL_METAS,
  type ToolMeta,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ToolDefinition,
  type TransportWriter,
} from "./services/mcpProtocol";

// ---- Config ----
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const CLI_PORT = parseInt(portIdx >= 0 ? args[portIdx + 1] : "27123", 10);
const hostIdx = args.indexOf("--host");
const HOST = hostIdx >= 0 ? args[hostIdx + 1] : "127.0.0.1";

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
          const data = JSON.parse(chunks) as { status?: string };
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

/** Detect if running inside WSL and collect possible Windows host IPs.
 *  Reads default gateway from /proc/net/route (WSL-specific) with
 *  a string-parsing fallback to known WSL2 vEthernet IPs. */
function resolveWSLHosts(): string[] {
  // WSL injects WSL_DISTRO_NAME automatically
  if (!process.env.WSL_DISTRO_NAME) {
    return []; // Not WSL
  }
  // Try to read default gateway from /proc/net/route (WSL-specific)
  try {
    const route = fs.readFileSync("/proc/net/route", "utf-8");
    const lines = route.trim().split("\n");
    for (const line of lines.slice(1)) {
      const parts = line.split("\t");
      // Destination "00000000" = 0.0.0.0 = default route
      if (parts[1] === "00000000") {
        const gwHex = parts[2]; // e.g. "01A015AC"
        const bytes = gwHex.match(/../g)?.reverse() ?? [];
        if (bytes.length === 4) {
          return [bytes.map((b) => parseInt(b, 16)).join(".")];
        }
      }
    }
  } catch {
    // Fallback: /proc/net/route may not exist on non-WSL or restricted fs
  }
  // Common WSL2 vEthernet gateway IPs (fallback)
  return ["172.17.224.1", "172.17.240.1", "172.17.0.1", "172.17.128.1"];
}

// ---- Build HTTP-calling tool handlers from shared tool metas ----

const httpTools: ToolDefinition[] = TOOL_METAS.map((meta: ToolMeta) => {
  const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
    health: async () => await apiGet("/health"),
    render_markdown: async (args_) =>
      await apiPost("/render", { content: args_.content, format: args_.format ?? "html" }),
    render_file: async (args_) =>
      await apiPost("/render", { filePath: args_.filePath, format: args_.format ?? "html" }),
    dataview_query: async (args_) =>
      await apiPost("/render/dataview", { query: args_.query, format: args_.format ?? "json" }),
    dataviewjs: async (args_) =>
      await apiPost("/render/dataview", { code: args_.code, format: args_.format ?? "text" }),
  };

  return {
    ...meta,
    handler: handlerMap[meta.name] ?? (async () => ({ error: "Unknown tool" })),
  };
});

const stdioWriter: TransportWriter = (response: JsonRpcResponse) => {
  process.stdout.write(JSON.stringify(response) + "\n");
};

// ---- Main ----
export async function startMcpServer(): Promise<void> {
  // Auto-detect hosts: configured host first, then WSL Windows hosts if detected
  const hostsToTry: { host: string; label: string }[] = [{ host: HOST, label: HOST }];
  const wslHosts = resolveWSLHosts();
  for (const wh of wslHosts) {
    if (wh !== HOST) {
      hostsToTry.push({ host: wh, label: `WSL host (${wh})` });
    }
  }

  // Try each host until we find the server
  for (const { host, label } of hostsToTry) {
    process.stderr.write(`[render-api-mcp] Trying ${label}...\n`);
    detectedPort = await detectServer(host, CLI_PORT);
    if (detectedPort) {
      activeBaseUrl = `http://${host}:${detectedPort}`;
      try {
        const health = await apiGet("/health") as Record<string, unknown>;
        process.stderr.write(`[render-api-mcp] Connected to Render API v${health.version ?? "unknown"} at ${host}:${detectedPort}\n`);
      } catch {
        process.stderr.write(`[render-api-mcp] Connected to Render API at ${host}:${detectedPort}\n`);
      }
      break;
    }
  }

  if (!detectedPort) {
    process.stderr.write(`[render-api-mcp] Warning: Render API not found. Tried: ${hostsToTry.map(h => h.label).join(", ")} ports ${Math.max(CLI_PORT - 5, 1024)}-${CLI_PORT + 5}. Start the plugin server first.\n`);
  }

  process.stderr.write(`[render-api-mcp] MCP server ready (stdio)\n`);

  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest;
      handleMcpRequest(req, { tools: httpTools }, stdioWriter);
    } catch {
      process.stderr.write(`[render-api-mcp] Failed to parse request: ${trimmed}\n`);
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// Auto-start when run directly as CLI (not imported)
if (require.main === module) {
  void startMcpServer();
}
