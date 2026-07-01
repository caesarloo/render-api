import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type RenderApiPlugin from "../main";
import type { McpTransport } from "../types";
import * as os from "node:os";

export class RenderApiSettingTab extends PluginSettingTab {
  private selectedAgent: "hermes" | "claude" = "hermes";
  private selectedEnv: "windows" | "wsl" = "windows";
  private wslGatewayIp = "172.17.64.1";
  constructor(
    app: App,
    private readonly plugin: RenderApiPlugin,
  ) {
    super(app, plugin);
  }

  private addCodeBlock(container: HTMLElement, text: string, cls: string): void {
    const wrapper = container.createEl("div", { cls: "render-api-code-wrapper" });
    const pre = wrapper.createEl("pre", { cls });
    pre.createEl("code", { text });

    const copyBtn = wrapper.createEl("button", {
      cls: "render-api-copy-btn",
      text: "Copy",
    });
    copyBtn.addEventListener("click", () => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.setText("Copied!");
          window.setTimeout(() => {
            copyBtn.setText("Copy");
          }, 2000);
        } catch {
          // Fallback: select text
          const range = activeDocument.createRange();
          range.selectNodeContents(pre);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          copyBtn.setText("Copied!");
          window.setTimeout(() => {
            copyBtn.setText("Copy");
          }, 2000);
        }
      })();
    });
  }

  /** Auto-detect the WSL gateway IP from Windows network interfaces. */
  private detectWslGatewayIp(): string | null {
    try {
      const interfaces = os.networkInterfaces();
      // Look for adapter named "WSL" (e.g. "vEthernet (WSL)")
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        if (name.toLowerCase().includes("wsl")) {
          for (const addr of addrs) {
            if (addr.family === "IPv4" && !addr.internal) {
              return addr.address;
            }
          }
        }
      }
      // Fallback: scan 172.x.x.x range for WSL-style gateway
      for (const [, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (addr.family === "IPv4" && addr.address.startsWith("172.") && !addr.internal) {
            return addr.address;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /** Build the settings UI into the given container element. */
  private renderSettings(containerEl: HTMLElement): void {
    containerEl.empty();

    // ── Server status ──
    const isRunning = this.plugin.apiServer?.isRunning ?? false;
    new Setting(containerEl)
      .setName("Server status")
      .setDesc(isRunning ? `Running on ${this.plugin.apiServer!.address}` : "Stopped")
      .addButton((btn) => {
        btn.setButtonText(isRunning ? "Stop Server" : "Start Server");
        btn.setCta();
        btn.onClick(async () => {
          if (isRunning) {
            await this.plugin.stopApiServer();
          } else {
            await this.plugin.startApiServer();
          }
          this.renderSettings(containerEl);
        });
      });

    // ── Render API settings group ──
    new Setting(containerEl).setName("Configuration").setHeading();

    // Server port
    new Setting(containerEl)
      .setName("Server port")
      .setDesc("Rest API server listen port")
      .addText((text) =>
        text
          .setPlaceholder("27123")
          .setValue(String(this.plugin.settings.serverPort))
          .onChange(async (value) => {
            this.plugin.settings.serverPort = parseInt(value, 10) || 27123;
            await this.plugin.saveSettings();
          }),
      );

    // Auto-start
    new Setting(containerEl)
      .setName("Start server on launch")
      .setDesc("Auto-start the API server when Obsidian launches")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableServerOnStart)
          .onChange(async (value) => {
            this.plugin.settings.enableServerOnStart = value;
            await this.plugin.saveSettings();
          }),
      );

    // Dataview toggle
    new Setting(containerEl)
      .setName("Enable dataview rendering")
      .setDesc("Allow executing dataview queries and dataviewjs code")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDataview)
          .onChange(async (value) => {
            this.plugin.settings.enableDataview = value;
            await this.plugin.saveSettings();
          }),
      );

    // Markdown render toggle
    new Setting(containerEl)
      .setName("Enable Markdown rendering")
      .setDesc("Allow rendering general Markdown content (including tasks etc.)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMarkdownRender)
          .onChange(async (value) => {
            this.plugin.settings.enableMarkdownRender = value;
            await this.plugin.saveSettings();
          }),
      );

    // API Key
    new Setting(containerEl)
      .setName("API key")
      .setDesc("Leave empty for no auth. When set, requests need X-API-Key header")
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    // CORS Origin
    new Setting(containerEl)
      .setName("Cors origin")
      .setDesc("Leave empty to allow all origins (*)")
      .addText((text) =>
        text
          .setPlaceholder("*")
          .setValue(this.plugin.settings.corsOrigin)
          .onChange(async (value) => {
            this.plugin.settings.corsOrigin = value;
            await this.plugin.saveSettings();
          }),
      );

    // ── MCP server section ──
    new Setting(containerEl).setName("Mcp server").setHeading();

    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Mcp (model context protocol) allows AI tools like hermes agent and Claude desktop to interact with your vault programmatically.",
    });

    // MCP Transport mode
    new Setting(containerEl)
      .setName("Mcp transport")
      .setDesc("Select how AI tools connect to the render API server")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("stdio", "Stdio (subprocess)")
          .addOption("streamable-http", "URL (streamable HTTP)")
          .setValue(this.plugin.settings.mcpTransport === "sse" ? "streamable-http" : this.plugin.settings.mcpTransport)
          .onChange(async (value: string) => {
            this.plugin.settings.mcpTransport = value as McpTransport;
            await this.plugin.saveSettings();
            const scrollContainer = containerEl.closest(".vertical-tab-content") || containerEl.parentElement;
            const savedScroll = scrollContainer?.scrollTop ?? 0;
            this.renderSettings(containerEl);
            window.requestAnimationFrame(() => {
              if (scrollContainer) scrollContainer.scrollTop = savedScroll;
            });
          }),
      );

    const transport = this.plugin.settings.mcpTransport === "sse" ? "streamable-http" : this.plugin.settings.mcpTransport;

    // ── MCP config container (for partial re-render) ──
    const mcpConfigEl = containerEl.createEl("div", { cls: "render-api-mcp-config" });

    // Agent selector (shared by both modes)
    new Setting(mcpConfigEl)
      .setName("Configuration for")
      .setDesc("Select an AI tool to show its mcp configuration")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("hermes", "Hermes agent")
          .addOption("claude", "Claude desktop")
          .setValue(this.selectedAgent)
          .onChange((value: string) => {
            this.selectedAgent = value as "hermes" | "claude";
            // Save and restore scroll position
            const scrollContainer = containerEl.closest(".vertical-tab-content") || containerEl.parentElement;
            const savedScroll = scrollContainer?.scrollTop ?? 0;
            this.renderSettings(containerEl);
            window.requestAnimationFrame(() => {
              if (scrollContainer) scrollContainer.scrollTop = savedScroll;
            });
          }),
      );

    // Environment selector (all modes)
    {
      new Setting(mcpConfigEl)
        .setName("Running environment")
        .setDesc("Where hermes/Claude runs: Windows native or wsl")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("windows", "Windows")
            .addOption("wsl", "WSL")
            .setValue(this.selectedEnv)
            .onChange((value: string) => {
              this.selectedEnv = value as "windows" | "wsl";
              const scrollContainer = containerEl.closest(".vertical-tab-content") || containerEl.parentElement;
              const savedScroll = scrollContainer?.scrollTop ?? 0;
              this.renderSettings(containerEl);
              window.requestAnimationFrame(() => {
                if (scrollContainer) scrollContainer.scrollTop = savedScroll;
              });
            }),
        );

      // WSL gateway IP input (only in URL modes when WSL is selected)
      if (this.selectedEnv === "wsl" && transport !== "stdio") {
        new Setting(mcpConfigEl)
          .setName("Wsl gateway IP")
          .setDesc("Run `ip route | grep default` in WSL to find your gateway IP, or click Detect")
          .addText((text) =>
            text
              .setPlaceholder("172.17.64.1")
              .setValue(this.wslGatewayIp)
              .onChange((value) => {
                this.wslGatewayIp = value || "172.17.64.1";
                const scrollContainer = containerEl.closest(".vertical-tab-content") || containerEl.parentElement;
                const savedScroll = scrollContainer?.scrollTop ?? 0;
                this.renderSettings(containerEl);
                window.requestAnimationFrame(() => {
                  if (scrollContainer) scrollContainer.scrollTop = savedScroll;
                });
              }),
          )
          .addButton((btn) =>
            btn.setButtonText("Detect")
              .setCta()
              .onClick(() => {
                const ip = this.detectWslGatewayIp();
                if (ip) {
                  this.wslGatewayIp = ip;
                  const scrollContainer = containerEl.closest(".vertical-tab-content") || containerEl.parentElement;
                  const savedScroll = scrollContainer?.scrollTop ?? 0;
                  this.renderSettings(containerEl);
                  window.requestAnimationFrame(() => {
                    if (scrollContainer) scrollContainer.scrollTop = savedScroll;
                  });
                } else {
                  new Notice("Could not detect WSL gateway IP. Run `ip route | grep default` in WSL.");
                }
              }),
          );
      }
    }

    if (transport === "streamable-http") {
      // ── URL mode config (Streamable HTTP) ──
      const port = this.plugin.settings.serverPort;
      const host = this.selectedEnv === "wsl" ? this.wslGatewayIp : "localhost";
      const url = `http://${host}:${port}/mcp`;

      if (this.selectedAgent === "hermes") {
        const yaml = [
          "mcp_servers:",
          "  render-api:",
          `    url: ${url}`,
          "    enabled: true",
        ].join("\n");
        new Setting(mcpConfigEl).setName("Configuration for hermes agent").setHeading();
        mcpConfigEl.createEl("p", {
          cls: "setting-item-description",
          text: this.selectedEnv === "wsl"
            ? `Streamable HTTP (WSL: use --noproxy * to bypass proxy) — Add to ~/.hermes/config.yaml`
            : `Streamable HTTP — Add to ~/.hermes/config.yaml`,
        });
        this.addCodeBlock(mcpConfigEl, yaml, "language-yaml");
      } else {
        const claudeJson = JSON.stringify(
          {
            mcpServers: {
              "render-api": {
                url,
              },
            },
          },
          null,
          2,
        );
        new Setting(mcpConfigEl).setName("Configuration for Claude desktop").setHeading();
        mcpConfigEl.createEl("p", {
          cls: "setting-item-description",
          text: this.selectedEnv === "wsl"
            ? `Streamable HTTP (WSL: set no_proxy env or use --noproxy) — Add to claude_desktop_config.json`
            : `Streamable HTTP — Add to claude_desktop_config.json`,
        });
        this.addCodeBlock(mcpConfigEl, claudeJson, "language-json");
      }
    } else if (transport === "stdio") {
      // ── stdio mode config (default) ──
      const adapter = this.app.vault.adapter as { getBasePath?: () => string };
      const vaultBasePath = adapter.getBasePath?.() ?? "";
      const configDir = this.app.vault.configDir;
      const fullConfigPath = (vaultBasePath
        ? `${vaultBasePath}/${configDir}`
        : configDir).replace(/\\/g, "/");
      const port = this.plugin.settings.serverPort;

      // Build paths based on environment
      let command: string;
      let serverPath: string;
      if (this.selectedEnv === "wsl") {
        // Convert Windows path to WSL path (C:/... → /mnt/c/...)
        command = "/mnt/c/Program Files/nodejs/node.exe";
        serverPath = fullConfigPath.replace(/^([A-Za-z]):\//, (_match: string, driveLetter: string) => `/mnt/${driveLetter.toLowerCase()}/`);
        serverPath = `${serverPath}/plugins/render-api/mcp-server.js`;
      } else {
        command = "node";
        serverPath = `${fullConfigPath}/plugins/render-api/mcp-server.js`;
      }

      if (this.selectedAgent === "hermes") {
        const hermesYaml = [
          "mcp_servers:",
          "  render-api:",
          `    command: ${command}`,
          `    args:`,
          `      - ${serverPath}`,
          `      - --port`,
          `      - ${port}`,
          "    enabled: true",
        ].join("\n");
        new Setting(mcpConfigEl).setName("Configuration for hermes agent").setHeading();
        mcpConfigEl.createEl("p", {
          cls: "setting-item-description",
          text: "Add to ~/.hermes/config.yaml",
        });
        this.addCodeBlock(mcpConfigEl, hermesYaml, "language-yaml");
      } else {
        const claudeJson = JSON.stringify(
          {
            mcpServers: {
              "render-api": {
                command,
                args: [serverPath, "--port", String(port)],
              },
            },
          },
          null,
          2,
        );
        new Setting(mcpConfigEl).setName("Configuration for Claude desktop").setHeading();
        mcpConfigEl.createEl("p", {
          cls: "setting-item-description",
          text: "Add to claude_desktop_config.json",
        });
        this.addCodeBlock(mcpConfigEl, claudeJson, "language-json");
      }
    }

    // Available tools
    new Setting(containerEl).setName("Available tools").setHeading();
    const toolList = containerEl.createEl("ul");
    const tools = [
      { name: "health", desc: "Check server status" },
      { name: "render_markdown", desc: "Render markdown content" },
      { name: "render_file", desc: "Render a vault file by path" },
      { name: "dataview_query", desc: "Execute Dataview DQL queries" },
      { name: "dataviewjs", desc: "Execute DataviewJS code" },
    ];
    for (const t of tools) {
      const li = toolList.createEl("li");
      li.createEl("strong", { text: t.name });
      li.appendText(` — ${t.desc}`);
    }
  }

  /** Backward compatibility with Obsidian <1.13.0 — called by the framework. */
  display(): void {
    this.renderSettings(this.containerEl);
  }

  /** @since Obsidian 1.13.0 — preferred over display(). */
  getSettingDefinitions(): SettingDefinitionItem[] {
    this.renderSettings(this.containerEl);
    return [];
  }
}
