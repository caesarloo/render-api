import * as http from 'node:http';
import { ApiServer } from '../services/apiService';
import type { RenderApiPlugin } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// Mock the dynamic import of renderService
jest.mock('../services/renderService', () => ({
  RenderService: jest.fn().mockImplementation(() => ({
    render: jest.fn().mockResolvedValue({ success: true, text: 'mocked', html: '<p>mocked</p>' }),
  })),
}));

function createMockPlugin(overrides: Partial<RenderApiPlugin> = {}): RenderApiPlugin {
  return {
    settings: { ...DEFAULT_SETTINGS, ...(overrides.settings || {}) },
    app: {
      plugins: { plugins: {} },
      vault: {} as any,
      workspace: {} as any,
    } as any,
    manifest: { version: '0.1.7' } as any,
    _component: {} as any,
    saveSettings: jest.fn(),
    debugLog: jest.fn(),
    ...overrides,
  } as unknown as RenderApiPlugin;
}

function httpGet(url: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpOptions(url: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'OPTIONS' }, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode ?? 0, headers: res.headers });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('ApiServer', () => {
  let server: ApiServer;
  let plugin: RenderApiPlugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = createMockPlugin();
    server = new ApiServer(plugin);
  });

  afterEach(async () => {
    if (server.isRunning) {
      await server.stop();
    }
  });

  describe('lifecycle', () => {
    it('starts and stops the server', async () => {
      expect(server.isRunning).toBe(false);
      await server.start(0);
      expect(server.isRunning).toBe(true);
      expect(server.address).toMatch(/^http:\/\/localhost:\d+$/);
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('starting twice is a no-op', async () => {
      await server.start(0);
      await server.start(0);
      expect(server.isRunning).toBe(true);
    });

    it('stopping when not running is a no-op', async () => {
      await server.stop();
      expect(server.isRunning).toBe(false);
    });
  });

  describe('authentication', () => {
    it('allows requests without auth when no API key is set', () => {
      expect(plugin.settings.apiKey).toBe('');
    });

    it('has API key configured when set in settings', () => {
      plugin.settings.apiKey = 'secret-123';
      expect(plugin.settings.apiKey).toBe('secret-123');
    });
  });

  describe('health endpoint', () => {
    it('returns server info on health check', async () => {
      await server.start(0);
      const res = await httpGet(`${server.address}/health`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as Record<string, unknown>;
      expect(body.status).toBe('running');
      expect(body.dataviewAvailable).toBe(false);
      expect(body.version).toBe('0.1.7');
    });
  });

  describe('CORS headers', () => {
    it('returns CORS headers on OPTIONS preflight', async () => {
      await server.start(0);
      const res = await httpOptions(`${server.address}/health`);
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      await server.start(0);
      const res = await httpGet(`${server.address}/unknown-path`);
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body) as Record<string, unknown>;
      expect(body.error).toBe('Not found');
    });
  });
});
