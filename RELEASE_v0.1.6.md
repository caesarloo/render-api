# Render API v0.1.6

**Release Date:** 2026-06-27

### Changes

1. **Release workflow robustness** — Gracefully handles re-triggered tag pushes by updating existing release assets instead of failing.
2. **CI fixes** — Resolved `npm ci` lockfile mismatch from partial jest install.

### Release Assets

- `dist/main.js`
- `dist/manifest.json`
- `dist/styles.css`
