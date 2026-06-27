import { Notice, Plugin } from "obsidian";
import { ApiServer } from "./services/apiService";
import { RenderService } from "./services/renderService";
import { RenderApiSettingTab } from "./views/RenderApiSettingTab";
import { t } from "./i18n";
import type { RenderApiSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export default class RenderApiPlugin extends Plugin {
  settings!: RenderApiSettings;
  apiServer: ApiServer | null = null;

  // Keep a component reference for MarkdownRenderer
  readonly _component = this;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "start-server",
      name: t("cmd.startServer", this.settings.language),
      callback: () => void this.startApiServer(),
    });

    this.addCommand({
      id: "stop-server",
      name: t("cmd.stopServer", this.settings.language),
      callback: () => void this.stopApiServer(),
    });

    this.addCommand({
      id: "open-settings",
      name: t("cmd.openSettings", this.settings.language),
      callback: () => {
        const setting = (this.app as unknown as Record<string, unknown>).setting as Record<string, unknown>;
        (setting.open as () => void)();
        (setting.openTabById as (id: string) => void)("render-api");
      },
    });

    this.addSettingTab(new RenderApiSettingTab(this.app, this));

    if (this.settings.enableServerOnStart) {
      this.app.workspace.onLayoutReady(() => {
        void this.startApiServer();
      });
    }

    this.debugLog("[Render API] Plugin loaded");
  }

  onunload(): void {
    void this.stopApiServer();
    this.debugLog("[Render API] Plugin unloaded");
  }

  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async startApiServer(): Promise<void> {
    if (this.apiServer?.isRunning) {
      new Notice(`Render API 已在 ${this.apiServer.address} 运行`);
      return;
    }

    try {
      this.apiServer = new ApiServer(this);
      await this.apiServer.start(this.settings.serverPort);
      new Notice(`Render API 服务已启动 → ${this.apiServer.address}`);
      this.debugLog(`[Render API] Server started on port ${this.settings.serverPort}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("in use")) {
        new Notice(t("server.portUnavailable", this.settings.language).replace("{port}", String(this.settings.serverPort)));
      } else {
        new Notice(t("server.startError", this.settings.language).replace("{error}", msg));
      }
      this.apiServer = null;
    }
  }

  async stopApiServer(): Promise<void> {
    if (!this.apiServer?.isRunning) return;
    await this.apiServer.stop();
    new Notice("Render API 服务已停止");
    this.apiServer = null;
  }

  getRenderService(): RenderService {
    return new RenderService(this.app, this._component);
  }

  debugLog(message: string, details?: unknown): void {
    if (details === undefined) {
      console.debug(message);
    } else {
      console.debug(message, details);
    }
  }
}
