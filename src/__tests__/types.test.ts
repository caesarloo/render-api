import { DEFAULT_SETTINGS } from '../types';
import type { RenderRequest, RenderResult } from '../types';

describe('types', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('has correct default values', () => {
      expect(DEFAULT_SETTINGS.serverPort).toBe(27123);
      expect(DEFAULT_SETTINGS.enableServerOnStart).toBe(false);
      expect(DEFAULT_SETTINGS.enableDataview).toBe(true);
      expect(DEFAULT_SETTINGS.enableMarkdownRender).toBe(true);
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
      expect(DEFAULT_SETTINGS.corsOrigin).toBe('');
      expect(DEFAULT_SETTINGS.language).toBe('zh');
    });
  });

  describe('RenderRequest', () => {
    it('accepts all field combinations', () => {
      const req: RenderRequest = {
        query: 'TABLE file.name FROM ""',
        format: 'json',
      };
      expect(req.query).toBe('TABLE file.name FROM ""');
      expect(req.format).toBe('json');
    });

    it('accepts dataviewjs code', () => {
      const req: RenderRequest = {
        code: 'dv.pages().length',
        format: 'text',
      };
      expect(req.code).toBe('dv.pages().length');
    });

    it('accepts file path', () => {
      const req: RenderRequest = {
        filePath: 'Daily/2026-06-27.md',
        format: 'html',
      };
      expect(req.filePath).toBe('Daily/2026-06-27.md');
    });

    it('accepts raw markdown content', () => {
      const req: RenderRequest = {
        content: '# Hello',
      };
      expect(req.content).toBe('# Hello');
    });
  });

  describe('RenderResult', () => {
    it('supports success result with html', () => {
      const result: RenderResult = {
        success: true,
        html: '<h1>Hello</h1>',
        text: 'Hello',
        mimeType: 'text/html',
      };
      expect(result.success).toBe(true);
      expect(result.html).toBe('<h1>Hello</h1>');
    });

    it('supports error result', () => {
      const result: RenderResult = {
        success: false,
        error: 'Something went wrong',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('supports JSON data result', () => {
      const result: RenderResult = {
        success: true,
        data: { count: 42 },
        mimeType: 'application/json',
      };
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 42 });
    });
  });
});
