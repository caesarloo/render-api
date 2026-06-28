import {
  App,
  Component,
  MarkdownRenderer,
  TFile,
} from "obsidian";

import type { RenderResult, RenderRequest } from "src/types";

/**
 * Minimal interface for the dataview plugin's exposed API.
 */
interface DataviewAPI {
  query(query: string): Promise<{ successful: boolean; value: unknown; type: string }>;
  execute(code: string, ...args: unknown[]): Promise<unknown>;
  [key: string]: unknown;
}

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
      if (req.query) {
        return await this.renderDataviewQuery(req.query, req.format);
      }
      if (req.code) {
        return await this.renderDataviewJS(req.code, req.format);
      }
      if (req.filePath) {
        const file = this.app.vault.getAbstractFileByPath(req.filePath);
        if (!file || !(file instanceof TFile)) {
          return { success: false, error: `File not found: ${req.filePath}` };
        }
        const content = await this.app.vault.read(file);
        return await this.renderMarkdown(content, req.filePath, req.format);
      }
      if (req.content) {
        return await this.renderMarkdown(req.content, "", req.format);
      }
      return { success: false, error: "No content, query, filePath, or code provided" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Render failed: ${msg}` };
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
      const result = await dvApi.query(query);
      if (!result.successful) {
        return { success: false, error: `Query execution failed: ${String(result.value)}` };
      }

      if (format === "json") {
        return { success: true, data: result.value as Record<string, unknown>, mimeType: "application/json" };
      }

      const text = this.dataviewResultToText(result.value);
      const html = `<pre>${this.escapeHtml(text)}</pre>`;

      return {
        success: true,
        text,
        html,
        data: result.value as Record<string, unknown>,
        mimeType: format === "text" ? "text/plain" : "text/html",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Query execution failed: ${msg}` };
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
      // Render dataviewJS code as a markdown code block so it goes through
      // Obsidian's full post-processor pipeline (same as opening a real note)
      const wrapped = "```dataviewjs\n" + code + "\n```";
      return await this.renderMarkdown(wrapped, "", format);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `JS execution failed: ${msg}` };
    }
  }

  // ---- Generic markdown (with post-processor support) ----

  private async renderMarkdown(
    content: string,
    sourcePath: string,
    format?: "html" | "text" | "json",
  ): Promise<RenderResult> {
    const doc = activeDocument;
    const el = doc.createElement("div");
    el.classList.add("render-api-render-container");
    doc.body.appendChild(el);

    try {
      await MarkdownRenderer.render(this.app, content, el, sourcePath, this.component);
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
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Markdown render failed: ${msg}` };
    } finally {
      el.remove();
    }
  }

  // ---- Helpers ----

  private getDataviewAPI(): DataviewAPI | null {
    const plugins = (this.app as unknown as Record<string, unknown>).plugins as Record<string, unknown> | undefined;
    const pluginRegistry = plugins?.plugins as Record<string, unknown> | undefined;
    const dvPlugin = pluginRegistry?.["dataview"] as Record<string, unknown> | undefined;
    return (dvPlugin?.api as DataviewAPI) ?? null;
  }

  private async waitForPostProcessors(): Promise<void> {
    await new Promise((r) => window.setTimeout(r, 50));
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.setTimeout(r, 50));
    await new Promise((r) => window.requestAnimationFrame(r));
  }

  private dataviewResultToText(result: unknown): string {
    if (!result) return "";
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.values)) {
      const headers = (r.headers as string[]) ?? [];
      const rows = r.values as unknown[][];
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
