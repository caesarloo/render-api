/**
 * Unit tests for RenderService.
 *
 * These tests use mocked Obsidian App/Component to verify the rendering
 * logic without requiring a real Obsidian environment.
 */

import { RenderService } from '../services/renderService';

// ---- Full mock of obsidian module ----
jest.mock('obsidian', () => ({
  MarkdownRenderer: { render: jest.fn() },
  Component: class MockComponent {},
  TFile: class MockTFile {},
  Plugin: class MockPlugin {},
  PluginSettingTab: class MockPluginSettingTab {
    constructor(public app: any, public plugin: any) {}
  },
  Setting: class MockSetting {
    settingEl = document.createElement('div');
    constructor(public containerEl: HTMLElement) {}
    setName(n: string) { return this; }
    setDesc(d: string) { return this; }
    setHeading() { return this; }
    addButton(cb: (b: any) => void) { return this; }
    addToggle(cb: (t: any) => void) { return this; }
    addText(cb: (t: any) => void) { return this; }
  },
  Notice: class MockNotice {
    constructor(public message: string) {}
  },
  addIcon: jest.fn(),
}), { virtual: true });

import { MarkdownRenderer } from 'obsidian';
import type { App, Component } from 'obsidian';

// Mock MarkdownRenderer
const mockRender = MarkdownRenderer.render as jest.Mock;

function createMockApp(dvApi: unknown = null): App {
  return {
    vault: {
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
    } as unknown as App['vault'],
    workspace: {
      getActiveViewOfType: jest.fn(),
    } as unknown as App['workspace'],
    plugins: {
      plugins: dvApi ? { dataview: { api: dvApi } } : {},
    },
  } as unknown as App;
}

const mockComponent = {} as Component;

describe('RenderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('render()', () => {
    it('returns error when no content provided', async () => {
      const service = new RenderService(createMockApp(), mockComponent);
      const result = await service.render({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No content');
    });

    it('returns dataview-not-available when querying without dataview', async () => {
      const service = new RenderService(createMockApp(), mockComponent);
      const result = await service.render({ query: 'TABLE file.name' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dataview plugin not enabled');
    });

    it('returns dataview-not-available for JS code without dataview', async () => {
      const service = new RenderService(createMockApp(), mockComponent);
      const result = await service.render({ code: 'dv.pages()' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('executes dataview DQL query successfully', async () => {
      const mockDvApi = {
        query: jest.fn().mockResolvedValue({
          successful: true,
          value: { headers: ['Name', 'Date'], values: [['test', '2026-01-01']] },
          type: 'table',
        }),
        execute: jest.fn(),
      };
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        query: 'TABLE file.name, file.mtime FROM ""',
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        headers: ['Name', 'Date'],
        values: [['test', '2026-01-01']],
      });
      expect(mockDvApi.query).toHaveBeenCalledWith('TABLE file.name, file.mtime FROM ""');
    });

    it('returns dataview DQL result as text', async () => {
      const mockDvApi = {
        query: jest.fn().mockResolvedValue({
          successful: true,
          value: { headers: ['Name'], values: [['hello'], ['world']] },
          type: 'table',
        }),
        execute: jest.fn(),
      };
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        query: 'TABLE file.name FROM ""',
        format: 'text',
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('Name');
      expect(result.text).toContain('hello');
      expect(result.text).toContain('world');
    });

    it('handles failed dataview DQL query', async () => {
      const mockDvApi = {
        query: jest.fn().mockResolvedValue({
          successful: false,
          value: 'Syntax error',
          type: 'error',
        }),
        execute: jest.fn(),
      };
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        query: 'INVALID SYNTAX',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query execution failed');
    });

    it('executes dataviewJS code and captures output', async () => {
      const mockDvApi = {
        query: jest.fn(),
        execute: jest.fn().mockImplementation(async (_code: string, _dv: unknown) => {
          const dv = _dv as Record<string, unknown>;
          const output = dv.output as (...args: unknown[]) => void;
          output('Hello, world!');
          output('Count:', 42);
        }),
      } as unknown as Record<string, unknown>;
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        code: 'dv.output("Hello")',
        format: 'text',
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('Hello, world!');
      expect(result.text).toContain('Count: 42');
    });

    it('reports error when dataviewJS execution throws', async () => {
      const mockDvApi = {
        query: jest.fn(),
        execute: jest.fn().mockRejectedValue(new Error('Undefined variable')),
      } as unknown as Record<string, unknown>;
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        code: 'dv.something.bad()',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Undefined variable');
    });

    it('renders file content when file exists', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TFile } = require('obsidian');
      const mockFile = new TFile();
      mockFile.path = 'test.md';
      const app = createMockApp();
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (app.vault.read as jest.Mock).mockResolvedValue('# Hello World\n\nThis is a **test**.');
      mockRender.mockImplementation(
        (_app: App, _content: string, el: HTMLElement, _path: string, _component: Component) => {
          el.innerHTML = '<h1>Hello World</h1><p>This is a <strong>test</strong>.</p>';
        },
      );

      const service = new RenderService(app, mockComponent);
      const result = await service.render({
        filePath: 'test.md',
        format: 'html',
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('Hello World');
      expect(result.html).toContain('<strong>test</strong>');
    });

    it('returns file-not-found for non-existent file', async () => {
      const app = createMockApp();
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const service = new RenderService(app, mockComponent);
      const result = await service.render({ filePath: 'nonexistent.md' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('renders raw markdown content', async () => {
      const app = createMockApp();
      mockRender.mockImplementation(
        (_app: App, _content: string, el: HTMLElement, _path: string, _component: Component) => {
          el.innerHTML = '<p>Hello <strong>world</strong></p>';
        },
      );

      const service = new RenderService(app, mockComponent);
      const result = await service.render({
        content: 'Hello **world**',
        format: 'html',
      });

      expect(result.success).toBe(true);
      expect(result.html).toBe('<p>Hello <strong>world</strong></p>');
      expect(result.mimeType).toBe('text/html');
    });

    it('escapes HTML in text output', async () => {
      const mockDvApi = {
        query: jest.fn().mockResolvedValue({
          successful: true,
          value: { headers: ['Col'], values: [['<script>alert("xss")</script>']] },
          type: 'table',
        }),
        execute: jest.fn(),
      };
      const service = new RenderService(createMockApp(mockDvApi), mockComponent);

      const result = await service.render({
        query: 'TABLE ...',
        format: 'html',
      });

      expect(result.success).toBe(true);
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });
  });
});
