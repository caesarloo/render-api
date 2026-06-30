/**
 * Shared MCP protocol logic — tool definitions, JSON-RPC handler.
 *
 * Used by:
 * - mcp-server-core.ts (stdio bridge — handlers call REST API via HTTP)
 * - apiService.ts (SSE transport — handlers call RenderService directly)
 */

import type { RenderRequest } from "src/types";

// ---- JSON-RPC types ----

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

// ---- Tool definition ----

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export type TransportWriter = (response: JsonRpcResponse) => void;

// ---- Tool metadata (names + schemas only, no handler) ----

export interface ToolMeta {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_METAS: ToolMeta[] = [
  {
    name: "health",
    description: "Check if the Render API server is running and healthy",
    inputSchema: {
      type: "object",
      properties: {},
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
  },
];

// ---- Convenience: build a RenderRequest from tool args ----

export function toolArgsToRenderRequest(
  toolName: string,
  args: Record<string, unknown>,
): RenderRequest | null {
  switch (toolName) {
    case "render_markdown":
      return {
        content: String(args.content ?? ""),
        format: (args.format as "html" | "text" | "json") ?? "html",
      };
    case "render_file":
      return {
        filePath: String(args.filePath ?? ""),
        format: (args.format as "html" | "text" | "json") ?? "html",
      };
    case "dataview_query":
      return {
        query: String(args.query ?? ""),
        format: (args.format as "html" | "text" | "json") ?? "json",
      };
    case "dataviewjs":
      return {
        code: String(args.code ?? ""),
        format: (args.format as "html" | "text" | "json") ?? "text",
      };
    default:
      return null;
  }
}

// ---- JSON-RPC handler ----

export interface McpHandlerContext {
  /** Tool definitions with their handlers filled in. */
  tools: ToolDefinition[];
}

/**
 * Process a single JSON-RPC MCP request.
 * Calls writer(response) with the result.
 */
export function handleMcpRequest(
  req: JsonRpcRequest,
  ctx: McpHandlerContext,
  writer: TransportWriter,
): void {
  const { id, method, params } = req;

  switch (method) {
    case "initialize": {
      writer({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "render-api-mcp",
            version: "0.2.1",
          },
        },
      });
      break;
    }

    case "notifications/initialized":
      break;

    case "tools/list": {
      writer({
        jsonrpc: "2.0",
        id,
        result: {
          tools: ctx.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
      break;
    }

    case "tools/call": {
      if (!params || typeof params.name !== "string") {
        writer({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Invalid params: name is required" },
        });
        return;
      }
      const tool = ctx.tools.find((t) => t.name === params.name);
      if (!tool) {
        writer({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Tool not found: ${params.name}` },
        });
        return;
      }
      tool
        .handler((params.arguments ?? {}) as Record<string, unknown>)
        .then((result) => {
          writer({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text:
                    typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2),
                },
              ],
            },
          });
        })
        .catch((err: Error) => {
          writer({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: `Tool execution failed: ${err.message}`,
            },
          });
        });
      break;
    }

    default:
      writer({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}
