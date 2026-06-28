import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianPlugin from "eslint-plugin-obsidianmd";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Everything in __tests__ uses test globals (jest, jsdom)
  {
    files: ["src/__tests__/**"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
        document: "readonly",
        window: "readonly",
      },
    },
  },

  // Obsidian plugin rules that DON'T need type info — all source files
  {
    plugins: { obsidianmd: obsidianPlugin },
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js"],
    rules: {
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/editor-drop-paste": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-global-this": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": ["error"],
      "obsidianmd/ui/sentence-case": ["error", { enforceCamelCaseLower: true }],
    },
  },

  // Obsidian plugin rules that NEED type info — source .ts only, no tests
  {
    plugins: { obsidianmd: obsidianPlugin },
    files: ["src/**/*.ts"],
    ignores: ["src/mcp-server.ts", "src/__tests__/**"],
    rules: {
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-unsupported-api": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-instanceof": "error",
    },
  },

  {
    ignores: [
      "dist/",
      "node_modules/",
      "esbuild.config.mjs",
      "jest.config.js",
    ],
  },

  // TypeScript type-checked config: source .ts files only (excl. tests)
  {
    files: ["src/**/*.ts"],
    ignores: ["src/mcp-server.ts", "src/__tests__/**"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
