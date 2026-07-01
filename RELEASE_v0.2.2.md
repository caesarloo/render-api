# Render API v0.2.2

## What's Changed

### Image Inlining (Major)

- **Wiki embed images** (`![[path/to/image.png]]`) are now automatically read from the vault, converted to base64 data URIs, and embedded inline in the rendered HTML. Previously these produced `app://obsidian.md/...` URLs that could not be resolved outside of Obsidian, or caused internal rendering errors with Chinese-language file paths.
- **Markdown image syntax** (`![alt](path)`) also gains data-URI inlining via the post-processing pipeline.
- **`render_markdown`** now accepts an optional `sourcePath` parameter, allowing relative attachment paths to be resolved correctly.

### Other Fixes

- ESLint warnings: `requestAnimationFrame` → `window.requestAnimationFrame`, explicit regex callback types.
- README updated with explanations for the 3 community-marketplace review warnings (identity info, filesystem access, clipboard).

## Files

- `main.js` — plugin code (includes embedded MCP server)
- `manifest.json` — plugin metadata
- `styles.css` — plugin styles
