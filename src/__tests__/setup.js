/**
 * Test setup: provide an activeDocument global for Obsidian compatibility.
 * In production, Obsidian injects this automatically.
 */
// @ts-expect-error - activeDocument is normally provided by Obsidian
// eslint-disable-next-line obsidianmd/no-global-this
globalThis.activeDocument = document;
