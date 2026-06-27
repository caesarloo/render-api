import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  obsidian.configs.recommended,
  {
    ignores: ["dist/", "node_modules/", "esbuild.config.mjs"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
