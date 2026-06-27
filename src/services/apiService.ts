import * as http from "node:http";
import type { RenderApiPlugin, RenderRequest } from "src/types";

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
    return new Promise((resolve, reject) => {
      if (this.server?.listening) {
        resolve();
        return;
      }

      this.port = port ?? this.plugin.settings.serverPort;
      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res),
      );

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
    return new Promise((resolve) => {
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
    try {
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

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const path = url.pathname;

      // Route
      if (path === "/health" || path === "/") {
        return this.handleHealth(res);
      }
      if (path === "/render" && req.method === "POST") {
        return this.handleRender(req, res);
      }
      if (path === "/render/dataview" && req.method === "POST") {
        return this.handleDataview(req, res);
      }
      if (path === "/render/file" && (req.method === "GET" || req.method === "POST")) {
        return this.handleFileRender(req, res, url);
      }

      this.sendJson(res, 404, { success: false, error: "Not found" });
    } catch (err) {
      this.plugin.debugLog("[Render API] Request error", err);
      this.sendJson(res, 500, { success: false, error: "Internal server error" });
    }
  }

  private async handleHealth(res: http.ServerResponse): Promise<void> {
    const dvPlugin = (this.plugin.app as any).plugins?.plugins?.["dataview"];
    this.sendJson(res, 200, {
      status: "running",
      port: this.port,
      dataviewAvailable: Boolean(dvPlugin),
      version: this.plugin.manifest.version,
    });
  }

  private async handleRender(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const body = await this.readBody(req);
    const renderReq: RenderRequest = JSON.parse(body);

    const renderService = new (await import("./renderService")).RenderService(
      this.plugin.app,
      (this.plugin as any)._component,
    );
    const result = await renderService.render(renderReq);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleDataview(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const body = await this.readBody(req);
    const { query, code, format } = JSON.parse(body);

    const renderService = new (await import("./renderService")).RenderService(
      this.plugin.app,
      (this.plugin as any)._component,
    );
    const result = await renderService.render({ query, code, format });
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleFileRender(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    let filePath: string;
    let format: string | undefined;

    if (req.method === "GET") {
      filePath = url.searchParams.get("path") ?? "";
      format = url.searchParams.get("format") ?? undefined;
    } else {
      const body = await this.readBody(req);
      const parsed = JSON.parse(body);
      filePath = parsed.filePath ?? "";
      format = parsed.format;
    }

    if (!filePath) {
      this.sendJson(res, 400, { success: false, error: "filePath is required" });
      return;
    }

    const renderService = new (await import("./renderService")).RenderService(
      this.plugin.app,
      (this.plugin as any)._component,
    );
    const result = await renderService.render({
      filePath,
      format: format as any,
    });
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  // ---- Helpers ----

  private checkAuth(req: http.IncomingMessage): boolean {
    const apiKey = this.plugin.settings.apiKey;
    if (!apiKey) return true; // no auth configured
    return req.headers["x-api-key"] === apiKey;
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
    data: unknown,
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
