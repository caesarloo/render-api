import * as http from "node:http";
import type { RenderRequest, RenderApiPlugin, RenderResult } from "src/types";

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
        resolve();
        return;
      }

      this.port = port ?? this.plugin.settings.serverPort;
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(() => {
          this.sendJson(res, 500, { success: false, error: "Internal server error" });
        });
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          this.server = null;
          reject(new Error(`Port ${this.port} is in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, "127.0.0.1", () => {
        this.plugin.debugLog(`[Render API] Server started on port ${this.port}`);
        resolve();
      });
    });
  }

  /** Stop the HTTP server */
  stop(): Promise<void> {
    return new Promise<void>((resolve) => {
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
    // Auth check
    if (!this.checkAuth(req)) {
      this.sendJson(res, 401, { success: false, error: "Unauthorized" });
      return;
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

      this.sendJson(res, 404, { success: false, error: "Not found" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.plugin.debugLog("[Render API] Request error", msg);
      this.sendJson(res, 500, { success: false, error: "Internal server error" });
    }
  }

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
      parsed = JSON.parse(body);
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
