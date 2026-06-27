import esbuild from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const isProduction = process.argv[2] === "production";

async function syncDistAssets() {
  await mkdir("dist", { recursive: true });
  await cp("manifest.json", "dist/manifest.json");
  await cp("styles.css", "dist/styles.css");
  await cp("versions.json", "dist/versions.json").catch(() => {});
}

// Main plugin bundle
const mainCtx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2020",
  platform: "node",
  logLevel: "info",
  sourcemap: isProduction ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
});

// MCP server bundle
const mcpCtx = await esbuild.context({
  entryPoints: ["src/mcp-server.ts"],
  bundle: true,
  external: [],
  format: "cjs",
  target: "es2020",
  platform: "node",
  logLevel: "info",
  sourcemap: false,
  treeShaking: true,
  outfile: "dist/mcp-server.js",
});

if (isProduction) {
  await mainCtx.rebuild();
  await mcpCtx.rebuild();
  await syncDistAssets();
  await mainCtx.dispose();
  await mcpCtx.dispose();
} else {
  await syncDistAssets();
  await Promise.all([mainCtx.watch(), mcpCtx.watch()]);
}
