import * as http from "node:http";
import type { RenderRequest, RenderApiPlugin, RenderResult } from "src/types";
import {
  handleMcpRequest,
  TOOL_METAS,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ToolDefinition,
  type TransportWriter,
} from "./mcpProtocol";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject { [key: string]: JsonValue | undefined }
type JsonArray = JsonValue[];

/**
 * Simple REST API server — no external dependencies.
 * Serves endpoints for rendering vault content.
 */
export class ApiServer {
  private server: http.Server | null = null;
  private port = 27123;

  // SSE state: active SSE response streams for MCP transport
  private sseClients: Set<http.ServerResponse> = new Set();

  constructor(private readonly plugin: RenderApiPlugin) {}

  get isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  get address(): string {
    return `http://localhost:${this.port}`;
  }

  /** Start the HTTP server on the configured port */
  start(port?: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.server?.listening) {
        console.log("[Render API] ApiServer.start() called but already listening");
        resolve();
        return;
      }

      this.port = port ?? this.plugin.settings.serverPort;
      console.log("[Render API] ApiServer creating HTTP server on port", this.port);

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(() => {
          this.sendJson(res, 500, { success: false, error: "Internal server error" });
        });
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        console.error("[Render API] HTTP server error:", err.code, err.message);
        if (err.code === "EADDRINUSE") {
          this.server = null;
          reject(new Error(`Port ${this.port} is in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, "0.0.0.0", () => {
        const addr = this.server?.address();
        if (addr && typeof addr === "object") {
          this.port = addr.port;
        }
        console.log("[Render API] HTTP server listening on 0.0.0.0:" + this.port);
        this.plugin.debugLog(`[Render API] Server started on port ${this.port}`);
        resolve();
      });
    });
  }

  /** Stop the HTTP server */
  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Close all SSE connections
      for (const client of this.sseClients) {
        client.end();
      }
      this.sseClients.clear();

      if (!this.server?.listening) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.plugin.debugLog("[Render API] Server stopped");
        this.server = null;
        resolve();
      });
    });
  }

  // ---- Request routing ----

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Auth check (skip for SSE connections — handled by first message)
    if (req.method !== "GET" || req.url !== "/mcp") {
      if (!this.checkAuth(req)) {
        this.sendJson(res, 401, { success: false, error: "Unauthorized" });
        return;
      }
    }

    // CORS
    this.setCorsHeaders(res);

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const rawUrl = req.url ?? "/";
    const host = req.headers.host ?? "localhost";
    const url = new URL(rawUrl, `http://${host}`);
    const path = url.pathname;

    try {
      if (path === "/health" || path === "/") {
        return this.handleHealth(res);
      }
      if (path === "/render" && req.method === "POST") {
        return await this.handleRender(req, res);
      }
      if (path === "/render/dataview" && req.method === "POST") {
        return await this.handleDataview(req, res);
      }
      if (path === "/render/file" && (req.method === "GET" || req.method === "POST")) {
        return await this.handleFileRender(req, res, url);
      }
      // MCP SSE transport
      if (path === "/mcp" && req.method === "GET") {
        return this.handleMcpSse(res);
      }
      // MCP Streamable HTTP — Hermes sends POST directly to /mcp
      if (path === "/mcp" && req.method === "POST") {
        return await this.handleMcpStreamableHttp(req, res);
      }
      if (path === "/mcp/message" && req.method === "POST") {
        return await this.handleMcpMessage(req, res);
      }

      this.sendJson(res, 404, { success: false, error: "Not found" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.plugin.debugLog("[Render API] Request error", msg);
      this.sendJson(res, 500, { success: false, error: "Internal server error" });
    }
  }

  // ---- Health ----

  private async handleHealth(res: http.ServerResponse): Promise<void> {
    const app = this.plugin.app as unknown as Record<string, unknown>;
    const plugins = app.plugins as Record<string, unknown> | undefined;
    const pluginRegistry = plugins?.plugins as Record<string, unknown> | undefined;
    const dvAvailable = Boolean(pluginRegistry?.["dataview"]);

    this.sendJson(res, 200, {
      status: "running",
      port: this.port,
      dataviewAvailable: dvAvailable,
      version: this.plugin.manifest.version,
    });
  }

  // ---- Render endpoints ----

  private async handleRender(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const body = await this.readBody(req);
    let renderReq: RenderRequest;
    try {
      renderReq = JSON.parse(body) as RenderRequest;
    } catch {
      this.sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      return;
    }

    const { RenderService } = await import("./renderService");
    const renderService = new RenderService(
      this.plugin.app,
      this.plugin._component,
    );
    const result = await renderService.render(renderReq);
    this.sendJson(res, result.success ? 200 : 400, toJsonObject(result));
  }

  private async handleDataview(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const body = await this.readBody(req);
    let parsed: { query?: string; code?: string; format?: string };
    try {
      parsed = JSON.parse(body) as { query?: string; code?: string; format?: string };
    } catch {
      this.sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      return;
    }

    const { RenderService } = await import("./renderService");
    const renderService = new RenderService(
      this.plugin.app,
      this.plugin._component,
    );
    const result = await renderService.render({
      query: parsed.query,
      code: parsed.code,
      format: parsed.format as "html" | "text" | "json" | undefined,
    });
    this.sendJson(res, result.success ? 200 : 400, toJsonObject(result));
  }

  private async handleFileRender(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    let filePath: string;
    let format: "html" | "text" | "json" | undefined;

    if (req.method === "GET") {
      filePath = url.searchParams.get("path") ?? "";
      const f = url.searchParams.get("format");
      format = (f === "html" || f === "text" || f === "json") ? f : undefined;
    } else {
      const body = await this.readBody(req);
      try {
        const parsed = JSON.parse(body) as { filePath?: string; format?: string };
        filePath = parsed.filePath ?? "";
        const f = parsed.format;
        format = (f === "html" || f === "text" || f === "json") ? f : undefined;
      } catch {
        this.sendJson(res, 400, { success: false, error: "Invalid JSON body" });
        return;
      }
    }

    if (!filePath) {
      this.sendJson(res, 400, { success: false, error: "filePath is required" });
      return;
    }

    const { RenderService } = await import("./renderService");
    const renderService = new RenderService(
      this.plugin.app,
      this.plugin._component,
    );
    const result = await renderService.render({ filePath, format });
    this.sendJson(res, result.success ? 200 : 400, toJsonObject(result));
  }

  // ---- MCP SSE Transport ----

  /**
   * GET /mcp — SSE endpoint.
   * Keeps connection open, streams MCP events to the client.
   */
  private handleMcpSse(res: http.ServerResponse): void {
    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send the endpoint event — client posts JSON-RPC messages here
    this.sseWrite(res, "endpoint", "/mcp/message");

    // Track this client
    this.sseClients.add(res);
    this.plugin.debugLog("[Render API] SSE client connected");

    // Clean up on disconnect
    res.on("close", () => {
      this.sseClients.delete(res);
      this.plugin.debugLog("[Render API] SSE client disconnected");
    });
  }

  /**
   * POST /mcp/message — receives JSON-RPC messages from MCP clients.
   * Processes them and sends responses back via the SSE stream.
   */
  private async handleMcpMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Find an SSE client to respond on
    const sseClient = this.sseClients.values().next().value;
    if (!sseClient) {
      this.sendJson(res, 503, {
        success: false,
        error: "No SSE connection established. Open GET /mcp first.",
      });
      return;
    }

    const body = await this.readBody(req);
    let jsonRpcReq: JsonRpcRequest;
    try {
      jsonRpcReq = JSON.parse(body) as JsonRpcRequest;
    } catch {
      this.sendJson(res, 400, { success: false, error: "Invalid JSON-RPC body" });
      return;
    }

    // Acknowledge receipt immediately
    this.sendJson(res, 202, { accepted: true });

    // Build SSE writer that sends responses on the SSE stream
    const sseWriter: TransportWriter = (response: JsonRpcResponse) => {
      this.sseWrite(sseClient, "message", JSON.stringify(response));
    };

    // Build tool handlers that call RenderService directly (not via HTTP)
    const renderTools = await this.buildSseToolHandlers();

    // Process the request
    handleMcpRequest(jsonRpcReq, { tools: renderTools }, sseWriter);
  }

  /**
   * POST /mcp — Streamable HTTP transport.
   * Processes JSON-RPC requests directly and returns responses inline.
   * Used by Hermes Agent's Streamable HTTP MCP client.
   */
  private async handleMcpStreamableHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const body = await this.readBody(req);
    let jsonRpcReq: JsonRpcRequest;
    try {
      jsonRpcReq = JSON.parse(body) as JsonRpcRequest;
    } catch {
      this.sendJson(res, 400, { success: false, error: "Invalid JSON-RPC body" });
      return;
    }

    // Notifications (no id) get empty 202 — no response expected
    if (jsonRpcReq.id === undefined) {
      res.writeHead(202);
      res.end();
      return;
    }

    const tools = await this.buildSseToolHandlers();

    const response = await new Promise<JsonRpcResponse>((resolve) => {
      const writer: TransportWriter = (response: JsonRpcResponse) => resolve(response);
      handleMcpRequest(jsonRpcReq, { tools }, writer);
    });

    this.sendJson(res, 200, response as unknown as Record<string, unknown>);
  }

  /** Write an SSE event to a client response stream. */
  private sseWrite(res: http.ServerResponse, event: string, data: string): void {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
  }

  /**
   * Build MCP tool handlers for SSE mode.
   * These call RenderService directly instead of going through HTTP.
   */
  private async buildSseToolHandlers(): Promise<ToolDefinition[]> {
    const { RenderService } = await import("./renderService");
    const renderService = new RenderService(
      this.plugin.app,
      this.plugin._component,
    );

    const handlerMap: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
      health: async () => {
        const app = this.plugin.app as unknown as Record<string, unknown>;
        const plugins = app.plugins as Record<string, unknown> | undefined;
        const pluginRegistry = plugins?.plugins as Record<string, unknown> | undefined;
        const dvAvailable = Boolean(pluginRegistry?.["dataview"]);
        return {
          status: "running",
          port: this.port,
          dataviewAvailable: dvAvailable,
          version: this.plugin.manifest.version,
        };
      },
      render_markdown: async (args_) => {
        const result = await renderService.render({
          content: String(args_.content ?? ""),
          format: (args_.format as "html" | "text" | "json") ?? "html",
        });
        return result;
      },
      render_file: async (args_) => {
        const result = await renderService.render({
          filePath: String(args_.filePath ?? ""),
          format: (args_.format as "html" | "text" | "json") ?? "html",
        });
        return result;
      },
      dataview_query: async (args_) => {
        const result = await renderService.render({
          query: String(args_.query ?? ""),
          format: (args_.format as "html" | "text" | "json") ?? "json",
        });
        return result;
      },
      dataviewjs: async (args_) => {
        const result = await renderService.render({
          code: String(args_.code ?? ""),
          format: (args_.format as "html" | "text" | "json") ?? "text",
        });
        return result;
      },
    };

    return TOOL_METAS.map((meta) => ({
      ...meta,
      handler: handlerMap[meta.name] ?? (async () => ({ error: "Unknown tool" })),
    }));
  }

  // ---- Helpers ----

  private checkAuth(req: http.IncomingMessage): boolean {
    const apiKey = this.plugin.settings.apiKey;
    if (!apiKey) return true;
    const header = req.headers["x-api-key"];
    return typeof header === "string" && header === apiKey;
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    const origin = this.plugin.settings.corsOrigin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  }

  private sendJson(
    res: http.ServerResponse,
    status: number,
    data: Record<string, unknown>,
  ): void {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      req.on("error", reject);
    });
  }
}

/** Convert a RenderResult to a JSON-safe plain object. */
function toJsonObject(result: RenderResult): Record<string, unknown> {
  return {
    success: result.success,
    data: result.data ?? null,
    html: result.html ?? null,
    text: result.text ?? null,
    error: result.error ?? null,
    mimeType: result.mimeType ?? null,
  };
}
