import { App, PluginSettingTab } from "obsidian";
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
            cls: "mod-cta",
            text: isRunning ? "Stop Server" : "Start Server",
          });
          btn.style.marginLeft = "12px";
          btn.addEventListener("click", async () => {
            if (isRunning) {
              await this.plugin.stopApiServer();
            } else {
              await this.plugin.startApiServer();
            }
            const app = this.app as unknown as {
              setting: { open: () => void; openTabById: (id: string) => void };
            };
            const s = app.setting;
            s.open();
            s.openTabById("render-api");
          });
        },
      } as SettingDefinitionItem,

      // Settings group
      {
        type: "group",
        heading: "Render API",
        items: groupItems,
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
