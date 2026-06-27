import {
  App,
  Component,
  MarkdownRenderer,
  TFile,
  parseYaml,
  stringifyYaml,
} from "obsidian";

import type { RenderResult, RenderRequest } from "src/types";

/**
 * Service responsible for rendering markdown / dataview content.
 *
 * Strategies:
 * 1. Dataview DQL — uses the dataview plugin's eval pipeline
 * 2. DataviewJS — executes arbitrary dv.* code via dataview's API
 * 3. General markdown — uses Obsidian's MarkdownRenderer, waits for
 *    post-processor (dataview, tasks, etc.) completion via microtask
 */
export class RenderService {
  constructor(
    private readonly app: App,
    private readonly component: Component,
  ) {}

  /**
   * Render a request. Tries dataview first if applicable, falls back to
   * generic markdown rendering.
   */
  async render(req: RenderRequest): Promise<RenderResult> {
    try {
      // 1) Dataview DQL query
      if (req.query) {
        return await this.renderDataviewQuery(req.query, req.format);
      }

      // 2) DataviewJS code
      if (req.code) {
        return await this.renderDataviewJS(req.code, req.format);
      }

      // 3) File content
      if (req.filePath) {
        const file = this.app.vault.getAbstractFileByPath(req.filePath);
        if (!file || !(file instanceof TFile)) {
          return { success: false, error: `File not found: ${req.filePath}` };
        }
        const content = await this.app.vault.read(file);
        return await this.renderMarkdown(content, req.filePath, req.format);
      }

      // 4) Raw markdown string
      if (req.content) {
        return await this.renderMarkdown(req.content, "", req.format);
      }

      return { success: false, error: "No content, query, filePath, or code provided" };
    } catch (err) {
      return {
        success: false,
        error: `Render failed: ${(err as Error).message}`,
      };
    }
  }

  // ---- Dataview DQL ----

  private async renderDataviewQuery(
    query: string,
    format?: "html" | "text" | "json",
  ): Promise<RenderResult> {
    const dvApi = this.getDataviewAPI();
    if (!dvApi) {
      return { success: false, error: "Dataview plugin not enabled or not installed" };
    }

    try {
      // Try executing as a full DQL query via the dataview query API
      const result: { successful: boolean; value: any; type: string } =
        await dvApi.query(query);

      if (!result.successful) {
        return { success: false, error: `Query execution failed: ${result.value}` };
      }

      if (format === "json") {
        return {
          success: true,
          data: result.value,
          mimeType: "application/json",
        };
      }

      // Convert result to readable text/HTML
      const text = this.dataviewResultToText(result.value);
      const html = `<pre>${this.escapeHtml(text)}</pre>`;

      return {
        success: true,
        text,
        html,
        data: result.value,
        mimeType: format === "text" ? "text/plain" : "text/html",
      };
    } catch (err) {
      return { success: false, error: `Query execution failed: ${(err as Error).message}` };
    }
  }

  // ---- DataviewJS ----

  private async renderDataviewJS(
    code: string,
    format?: "html" | "text" | "json",
  ): Promise<RenderResult> {
    const dvApi = this.getDataviewAPI();
    if (!dvApi) {
      return { success: false, error: "Dataview plugin not enabled or not installed" };
    }

    try {
      // Execute dataviewJS: eval the code and collect what dv.output() produces
      const output: string[] = [];
      const dvProxy = new Proxy(dvApi, {
        get(target, prop, receiver) {
          if (prop === "output") {
            return (...args: unknown[]) => {
              output.push(args.map(String).join(" "));
            };
          }
          if (prop === "header") {
            return (_level: number, ...args: unknown[]) => {
              output.push(args.map(String).join(" "));
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const result = await dvApi.execute(code, dvProxy);
      const text = output.join("\n") + (result !== undefined ? `\n${String(result)}` : "");

      if (format === "json") {
        return { success: true, data: { output, result }, mimeType: "application/json" };
      }

      const html = `<pre>${this.escapeHtml(text)}</pre>`;
      return {
        success: true,
        text,
        html,
        data: { output, result },
        mimeType: format === "text" ? "text/plain" : "text/html",
      };
    } catch (err) {
      return { success: false, error: `JS execution failed: ${(err as Error).message}` };
    }
  }

  // ---- Generic markdown (with post-processor support) ----

  private async renderMarkdown(
    content: string,
    sourcePath: string,
    format?: "html" | "text" | "json",
  ): Promise<RenderResult> {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);

    try {
      await MarkdownRenderer.render(this.app, content, el, sourcePath, this.component);

      // Wait for post-processors (dataview, tasks, etc.) to finish
      // Post-processors typically resolve in the next microtask/macrotask
      await this.waitForPostProcessors();

      const html = el.innerHTML;
      const text = el.textContent ?? "";

      if (format === "json") {
        return { success: true, data: { html, text }, mimeType: "application/json" };
      }
      if (format === "text") {
        return { success: true, text, mimeType: "text/plain" };
      }
      return { success: true, html, text, mimeType: "text/html" };
    } catch (err) {
      return { success: false, error: `Markdown render failed: ${(err as Error).message}` };
    } finally {
      el.remove();
    }
  }

  // ---- Helpers ----

  private getDataviewAPI(): any {
    const dvPlugin = (this.app as any).plugins?.plugins?.["dataview"];
    return dvPlugin?.api ?? null;
  }

  /**
   * Wait for Obsidian's markdown post-processors to finish rendering.
   * Strategy: yield control multiple times to let the event loop drain
   * post-processor queues (dataview, tasks, etc.).
   */
  private async waitForPostProcessors(): Promise<void> {
    // Give post-processors a chance to run
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => requestAnimationFrame(r));
    // Extra settle for plugins that batch updates
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => requestAnimationFrame(r));
  }

  private dataviewResultToText(result: any): string {
    if (!result) return "";
    if (Array.isArray(result.values)) {
      const headers = result.headers ?? [];
      const rows = result.values as any[][];
      const lines = [headers.join("\t")];
      for (const row of rows) {
        lines.push(row.map((v) => String(v ?? "")).join("\t"));
      }
      return lines.join("\n");
    }
    return JSON.stringify(result, null, 2);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
