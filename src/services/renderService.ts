import {
  App,
  Component,
  MarkdownRenderer,
  TFile,
} from "obsidian";

import type { RenderResult, RenderRequest } from "src/types";

// MIME type map for image file extensions
const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
};

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
        // Use explicit sourcePath if provided, otherwise empty (no path context)
        const sourcePath = req.sourcePath ?? "";
        return await this.renderMarkdown(req.content, sourcePath, req.format);
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
      // Preprocess wiki-style embeds to inline base64 <img> tags
      const preprocessed = await this.preprocessWikiEmbeds(content, sourcePath);
      await MarkdownRenderer.render(this.app, preprocessed, el, sourcePath, this.component);
      await this.waitForPostProcessors();

      let html = el.innerHTML;
      const text = el.textContent ?? "";

      // Inline images: convert app:// URLs to base64 data URIs
      html = await this.inlineImages(html);

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

  /**
   * Preprocess Obsidian wiki-style image embeds (![[...]]) to inline
   * base64 `<img>` tags.  This avoids an Obsidian internal rendering error
   * where MarkdownRenderer fails on ![[...]] embeds for image files with
   * Chinese paths.
   *
   * Image files (png, jpg, etc.) are read directly via the vault API,
   * converted to base64, and embedded inline.  Non-image embeds (notes,
   * PDFs, etc.) pass through unchanged.
   */
  private async preprocessWikiEmbeds(
    content: string,
    sourcePath: string,
  ): Promise<string> {
    const IMAGE_EXTS = new Set([
      "png", "jpg", "jpeg", "gif", "webp", "svg",
      "bmp", "ico", "tiff", "tif", "avif",
    ]);

    const replacements: Array<{
      match: string;
      html: string;
      vaultPath: string;
      alt: string;
      ext: string;
    }> = [];

    // Collect replacement info first (no async in the replace callback)
    const regex = /!\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const inner = match[1];
      const parts = inner.split("|");
      const embedPath = parts[0].trim();
      const altOrSize = parts[1]?.trim() ?? "";

      const ext = embedPath.split(".").pop()?.toLowerCase();
      if (!ext || !IMAGE_EXTS.has(ext)) continue;

      const isDimension = /^\d+[xX]\d+$/.test(altOrSize) || /^\d+$/.test(altOrSize);
      const alt = altOrSize && !isDimension ? altOrSize : "image";

      // ![[...]] paths are always vault-root-relative, use as-is
      const vaultPath = embedPath;

      replacements.push({ match: fullMatch, html: "", vaultPath, alt, ext });
    }

    if (replacements.length === 0) return content;

    // Read images concurrently and build data URIs
    const results = await Promise.all(replacements.map(async (r) => {
      try {
        const file = this.app.vault.getAbstractFileByPath(r.vaultPath);
        if (!file || !(file instanceof TFile)) return null;
        const arrayBuffer = await this.app.vault.readBinary(file);
        const base64 = this.arrayBufferToBase64(arrayBuffer);
        const mimeType = this.getMimeType(r.ext);
        return {
          original: r.match,
          html: `<img src="data:${mimeType};base64,${base64}" alt="${r.alt}">`,
        };
      } catch {
        return null;
      }
    }));

    // Apply all replacements (valid ones only)
    let result = content;
    for (const item of results) {
      if (item) {
        result = result.split(item.original).join(item.html);
      }
    }
    return result;
  }

  /**
   * Scan HTML for <img> tags with app:// URLs (Obsidian internal protocol),
   * read the referenced binary files via the vault API, and replace with
   * base64 data URIs so the HTML is self-contained.
   *
   * Handles both formats:
   *   app://obsidian.md/path/to/file.png       (vault-relative path)
   *   app://obsidian.md/C:/path/to/file.png    (Windows absolute path)
   */
  private async inlineImages(html: string): Promise<string> {
    // Match all <img> tags with app:// src
    const imgRegex = /<img[^>]+src="(app:\/\/[^"]+)"[^>]*>/gi;
    const appUrls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(html)) !== null) {
      appUrls.push(match[1]);
    }

    if (appUrls.length === 0) return html;

    // Deduplicate by URL to avoid redundant reads
    const uniqueUrls = [...new Set(appUrls)];

    // Get vault base path for Windows absolute path → vault-relative conversion
    const vaultAdapter = this.app.vault.adapter as { getFullPath?: () => string; basePath?: string };
    const vaultBasePath: string = vaultAdapter.getFullPath?.() ?? vaultAdapter.basePath ?? "";

    // Process all images concurrently
    const urlToDataUri = new Map<string, string>();
    await Promise.all(uniqueUrls.map(async (appUrl) => {
      try {
        const parsed = new URL(appUrl);
        // URL pathname starts with / — remove it to get the actual path
        let filePath = decodeURIComponent(parsed.pathname).replace(/^[/\\]/, "");

        // If it's a Windows absolute path (e.g. C:/path/...), strip vault base path
        if (/^[A-Za-z]:[/\\]/.test(filePath) && vaultBasePath) {
          const normalizedBase = vaultBasePath.replace(/\\/g, "/").replace(/\/+$/, "");
          const normalizedPath = filePath.replace(/\\/g, "/");
          if (normalizedPath.startsWith(normalizedBase + "/")) {
            filePath = normalizedPath.slice(normalizedBase.length + 1);
          } else {
            return; // file outside vault — can't read via vault API
          }
        }

        // Guard against unresolved absolute paths
        if (/^[A-Za-z]:[/\\]/.test(filePath) || filePath.startsWith("/")) {
          return;
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) return;

        const arrayBuffer = await this.app.vault.readBinary(file);
        const base64 = this.arrayBufferToBase64(arrayBuffer);
        const mimeType = this.getMimeType(file.extension);
        urlToDataUri.set(appUrl, `data:${mimeType};base64,${base64}`);
      } catch {
        // Silently skip images that can't be processed
      }
    }));

    if (urlToDataUri.size === 0) return html;

    // Apply all replacements
    let result = html;
    for (const [original, dataUri] of urlToDataUri) {
      result = result.split(original).join(dataUri);
    }
    return result;
  }

  /** Convert ArrayBuffer to base64 string. */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /** Get MIME type from file extension. */
  private getMimeType(ext: string): string {
    return MIME_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
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
