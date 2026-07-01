import type { Plugin } from "obsidian";
import type { ApiServer } from "./services/apiService";

export type McpTransport = "stdio" | "sse" | "streamable-http";

export interface RenderApiSettings {
  serverPort: number;
  enableServerOnStart: boolean;
  enableDataview: boolean;
  enableMarkdownRender: boolean;
  apiKey: string; // empty = no auth
  corsOrigin: string; // empty = allow all
  language: "zh" | "en";
  mcpTransport: McpTransport; // "stdio" (default) or "sse"
}

export interface RenderResult {
  success: boolean;
  data?: string | Record<string, unknown>;
  html?: string;
  text?: string;
  error?: string;
  mimeType?: string;
}

export interface RenderRequest {
  /** Raw markdown content to render */
  content?: string;
  /** Vault file path relative to vault root */
  filePath?: string;
  /** Dataview DQL query (e.g. "TABLE ... FROM ...") */
  query?: string;
  /** DataviewJS code */
  code?: string;
  /** Output format: "html" (default) | "text" | "json" */
  format?: "html" | "text" | "json";
}

export interface RenderApiPlugin extends Plugin {
  settings: RenderApiSettings;
  apiServer: ApiServer | null;
  saveSettings(): Promise<void>;
  debugLog(message: string, details?: unknown): void;
  /** Used as a Component for MarkdownRenderer */
  _component: Plugin;
}

export const VIEW_TYPE_RENDER_API = "render-api-panel";

export const DEFAULT_SETTINGS: RenderApiSettings = {
  serverPort: 27123,
  enableServerOnStart: false,
  enableDataview: true,
  enableMarkdownRender: true,
  apiKey: "",
  corsOrigin: "",
  language: "zh",
  mcpTransport: "stdio",
};
