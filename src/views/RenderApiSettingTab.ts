import { App, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem, SettingGroupItem } from "obsidian";
import type RenderApiPlugin from "../main";

export class RenderApiSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: RenderApiPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * Declarative settings definition (Obsidian 1.13+).
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const groupItems: SettingGroupItem[] = [
      // Server port
      {
        name: "Server Port",
        desc: "REST API server listen port",
        control: { type: "text", key: "serverPort", placeholder: "27123" },
      },
      // Auto-start
      {
        name: "Start Server on Launch",
        desc: "Auto-start the API server when Obsidian launches",
        control: { type: "toggle", key: "enableServerOnStart" },
      },
      // Dataview toggle
      {
        name: "Enable Dataview Rendering",
        desc: "Allow executing dataview queries and dataviewjs code",
        control: { type: "toggle", key: "enableDataview" },
      },
      // Markdown render toggle
      {
        name: "Enable Markdown Rendering",
        desc: "Allow rendering general markdown content (including Tasks etc.)",
        control: { type: "toggle", key: "enableMarkdownRender" },
      },
      // API Key
      {
        name: "API Key",
        desc: "Leave empty for no auth. When set, requests need X-API-Key header",
        control: { type: "text", key: "apiKey", placeholder: "" },
      },
      // CORS
      {
        name: "CORS Origin",
        desc: "Leave empty to allow all origins (*)",
        control: { type: "text", key: "corsOrigin", placeholder: "*" },
      },
    ];

    return [
      // Server status — render item at top level
      {
        name: "",
        render: (_setting) => {
          const isRunning = this.plugin.apiServer?.isRunning ?? false;
          const container = _setting.settingEl;
          container.createSpan({
            cls: `render-api-status-badge ${isRunning ? "running" : "stopped"}`,
            text: isRunning
              ? `● Running — ${this.plugin.apiServer!.address}`
              : `○ Stopped`,
          });
          const btn = container.createEl("button", {
            cls: "mod-cta render-api-start-btn",
            text: isRunning ? "Stop Server" : "Start Server",
          });
          btn.addEventListener("click", () => {
            const action = isRunning
              ? this.plugin.stopApiServer()
              : this.plugin.startApiServer();
            action.then(() => {
              const app = this.app as unknown as {
                setting: { open: () => void; openTabById: (id: string) => void };
              };
              const s = app.setting;
              s.open();
              s.openTabById("render-api");
            }).catch(() => {
              // Errors already reported by startApiServer/stopApiServer
            });
          });
        },
      } as SettingDefinitionItem,

      // Settings group
      {
        type: "group",
        heading: "Render API",
        items: groupItems,
      } as SettingDefinitionItem,

      // MCP section
      {
        name: "",
        render: (_setting) => {
          const container = _setting.settingEl;

          // Section heading
          const mcpHeading = new Setting(container)
            .setHeading();
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          mcpHeading.setName("MCP server");

          const desc = container.createEl("p", { cls: "setting-item-description" });
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          desc.setText("MCP (Model Context Protocol) allows AI tools like Hermes Agent and Claude Desktop to interact with your vault programmatically.");

          const configDir = this.app.vault.configDir;
          const mcpPath = `<${configDir}>/plugins/render-api/mcp-server.js`;

          const hermesSetting = new Setting(container);
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          hermesSetting.setName("Configuration for Hermes Agent");
          hermesSetting.setDesc("Add to ~/.hermes/config.yaml");

          const hermesBlock = container.createEl("pre", {
            cls: "language-yaml",
          });
          hermesBlock.createEl("code", {
            text: `mcp_servers:\n  render-api:\n    command: node\n    args:\n      - ${mcpPath}\n    enabled: true`,
          });

          const claudeSetting = new Setting(container);
          // eslint-disable-next-line obsidianmd/ui/sentence-case
          claudeSetting.setName("Configuration for Claude Desktop");
          claudeSetting.setDesc("Add to claude_desktop_config.json");

          const claudeBlock = container.createEl("pre", {
            cls: "language-json",
          });
          claudeBlock.createEl("code", {
            text: JSON.stringify(
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
            ),
          });

          new Setting(container)
            .setName("Available tools")
            .setHeading();

          const toolList = container.createEl("ul");
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
        },
      } as SettingDefinitionItem,
    ];
  }

  /** Read a setting value by key. */
  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  /** Persist a setting value by key. */
  setControlValue(key: string, value: unknown): void {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    void this.plugin.saveSettings();
  }
}
