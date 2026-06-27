/**
 * Unit tests for RenderService.
 *
 * These tests use mocked Obsidian App/Component to verify the rendering
 * logic without requiring a real Obsidian environment.
 */

// ---- Mock Obsidian module ----
const mockRenderFn = jest.fn();
const mockReadFn = jest.fn();

jest.mock('obsidian', () => {
  const actual = jest.requireActual('obsidian');
  return {
    ...actual,
    MarkdownRenderer: {
      render: (...args: unknown[]) => mockRenderFn(...args),
    },
  };
});

import { RenderService } from '../services/renderService';
import type { App, Component } from 'obsidian';

function createMockApp(dvApi: unknown = null): App {
  return {
    vault: {
      getAbstractFileByPath: jest.fn(),
      read: mockReadFn,
      cachedRead: jest.fn(),
    } as unknown as App['vault'],
    workspace: {
      getActiveViewOfType: jest.fn(),
    },
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
          // Simulate dv.output() calls
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
      const mockFile = { path: 'test.md', vault: { read: jest.fn() } };
      const app = createMockApp();
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      mockReadFn.mockResolvedValue('# Hello World\n\nThis is a **test**.');
      mockRenderFn.mockImplementation(
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
      mockRenderFn.mockImplementation(
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
