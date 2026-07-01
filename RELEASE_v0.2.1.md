# v0.2.1 Release Notes

## Bug Fixes

- **Hermes Streamable HTTP compatibility** — Added `POST /mcp` route for direct JSON-RPC handling (Hermes sends POST directly, unlike the old GET+POST SSE pattern). Fixes 404 error when using `url:` mode with Hermes Agent.

## Settings UI Improvements

- **Transport options merged** — Simplified to two clear choices: Stdio (subprocess) and URL (Streamable HTTP). The same URL endpoint supports both SSE and Streamable HTTP protocols automatically.
- **Actual vault path** — Stdio config now shows the real path instead of `<.obsidian>` placeholder.
- **Agent selector** — Dropdown to choose Hermes Agent or Claude Desktop config, with one-click copy.
- **Environment selector** — Choose Windows or WSL runtime. WSL mode auto-detects gateway IP via `os.networkInterfaces()` with a "Detect" button.
- **Stdio config includes `--port`** — Ensures mcp-server.js connects to the correct HTTP server port.
- **Config code blocks now have a border** — Visually distinct from other settings.
- **Dropdown no longer scrolls to top** — Scroll position is preserved on re-render.
