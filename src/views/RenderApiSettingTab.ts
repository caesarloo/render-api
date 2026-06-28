import { App, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type RenderApiPlugin from "../main";

export class RenderApiSettingTab extends PluginSettingTab {
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

    const configDir = this.app.vault.configDir;
    const mcpPath = `<${configDir}>/plugins/render-api/mcp-server.js`;
    const hermesYaml = `mcp_servers:\n  render-api:\n    command: node\n    args:\n      - ${mcpPath}\n    enabled: true`;

    const claudeJson = JSON.stringify(
      {
        mcpServers: {
          "render-api": {
            command: "node",
            args: [mcpPath],
          },
        },
      },
      null,
      2,
    );

    // Hermes agent config
    new Setting(containerEl).setName("Configuration for hermes agent").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Add to ~/.hermes/config.yaml",
    });
    this.addCodeBlock(containerEl, hermesYaml, "language-yaml");

    // Claude desktop config
    new Setting(containerEl).setName("Configuration for Claude desktop").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Add to claude_desktop_config.json",
    });
    this.addCodeBlock(containerEl, claudeJson, "language-json");

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
