# v0.1.21 Release Notes

## Changes

- **minAppVersion 降回 1.7.2** — 所有版本的最低 Obsidian 版本统一为 1.7.2（与 v0.1.3 和 Vault SVN 一致）。`SettingDefinitionItem` 改为 `import type` 消除运行时依赖，`getSettingDefinitions()` 在 <1.13.0 版本中不会被调用（回退到 `display()`）。
