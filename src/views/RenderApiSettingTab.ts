import { App, PluginSettingTab, Setting } from "obsidian";
import { t } from "../i18n";
import type RenderApiPlugin from "../main";

export class RenderApiSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: RenderApiPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const lang = this.plugin.settings.language;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("plugin.name", lang))
      .setHeading();

    // ---- Server status ----
    const statusContainer = containerEl.createDiv();
    statusContainer.createSpan({
      cls: `render-api-status-badge ${
        this.plugin.apiServer?.isRunning ? "running" : "stopped"
      }`,
      text: this.plugin.apiServer?.isRunning
        ? `● ${t("server.running", lang)} — ${this.plugin.apiServer.address}`
        : `○ ${t("server.stopped", lang)}`,
    });

    new Setting(containerEl)
      .setName(
        this.plugin.apiServer?.isRunning
          ? t("server.stop", lang)
          : t("server.start", lang),
      )
      .addButton((btn) =>
        btn
          .setButtonText(
            this.plugin.apiServer?.isRunning
              ? t("server.stop", lang)
              : t("server.start", lang),
          )
          .onClick(async () => {
            if (this.plugin.apiServer?.isRunning) {
              await this.plugin.stopApiServer();
            } else {
              try {
                await this.plugin.startApiServer();
              } catch (_err) {
                // Error notice already shown by main.ts
              }
            }
            this.display();
          }),
      );

    // ---- Port ----
    new Setting(containerEl)
      .setName(t("setting.serverPort", lang))
      .setDesc(t("setting.serverPort.desc", lang))
      .addText((text) =>
        text
          .setPlaceholder("27123")
          .setValue(String(this.plugin.settings.serverPort))
          .onChange(async (val) => {
            const port = parseInt(val, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.serverPort = port;
              await this.plugin.saveSettings();
            }
          }),
      );

    // ---- Auto-start ----
    new Setting(containerEl)
      .setName(t("setting.enableServerOnStart", lang))
      .setDesc(t("setting.enableServerOnStart.desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableServerOnStart)
          .onChange(async (val) => {
            this.plugin.settings.enableServerOnStart = val;
            await this.plugin.saveSettings();
          }),
      );

    // ---- Dataview toggle ----
    new Setting(containerEl)
      .setName(t("setting.enableDataview", lang))
      .setDesc(t("setting.enableDataview.desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableDataview)
          .onChange(async (val) => {
            this.plugin.settings.enableDataview = val;
            await this.plugin.saveSettings();
          }),
      );

    // ---- Markdown render toggle ----
    new Setting(containerEl)
      .setName(t("setting.enableMarkdownRender", lang))
      .setDesc(t("setting.enableMarkdownRender.desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableMarkdownRender)
          .onChange(async (val) => {
            this.plugin.settings.enableMarkdownRender = val;
            await this.plugin.saveSettings();
          }),
      );

    // ---- API Key ----
    new Setting(containerEl)
      .setName(t("setting.apiKey", lang))
      .setDesc(t("setting.apiKey.desc", lang))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (val) => {
            this.plugin.settings.apiKey = val;
            await this.plugin.saveSettings();
          }),
      );

    // ---- CORS ----
    new Setting(containerEl)
      .setName(t("setting.corsOrigin", lang))
      .setDesc(t("setting.corsOrigin.desc", lang))
      .addText((text) =>
        text
          .setPlaceholder("*")
          .setValue(this.plugin.settings.corsOrigin)
          .onChange(async (val) => {
            this.plugin.settings.corsOrigin = val;
            await this.plugin.saveSettings();
          }),
      );
  }

  /**
   * getSettingDefinitions is available in Obsidian 1.13+.
   * We keep display() for backward compatibility with 1.7.2.
   * eslint-disable-next-line obsidianmd/no-deprecated-method
   */
}
