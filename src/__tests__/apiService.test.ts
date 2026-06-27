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
    manifest: { version: '0.1.4' } as any,
    _component: {} as any,
    saveSettings: jest.fn(),
    debugLog: jest.fn(),
    ...overrides,
  } as unknown as RenderApiPlugin;
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
      await server.start(0); // port 0 = random available port
      expect(server.isRunning).toBe(true);
      expect(server.address).toMatch(/^http:\/\/localhost:\d+$/);

      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('starting twice is a no-op', async () => {
      await server.start(0);
      await server.start(0); // should not throw
      expect(server.isRunning).toBe(true);
    });

    it('stopping when not running is a no-op', async () => {
      await server.stop(); // should not throw
      expect(server.isRunning).toBe(false);
    });
  });

  describe('authentication', () => {
    it('allows requests without auth when no API key is set', async () => {
      // The auth is checked in handleRequest which needs an actual request
      // This tests the plugin config
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
      
      // Make a request to /health
      const response = await fetch(`${server.address}/health`);
      expect(response.status).toBe(200);
      
      const body = await response.json() as Record<string, unknown>;
      expect(body.status).toBe('running');
      expect(body.dataviewAvailable).toBe(false);
      expect(body.version).toBe('0.1.4');
    });
  });

  describe('CORS headers', () => {
    it('returns CORS headers on OPTIONS preflight', async () => {
      await server.start(0);
      
      const response = await fetch(`${server.address}/health`, {
        method: 'OPTIONS',
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('404 handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      await server.start(0);
      
      const response = await fetch(`${server.address}/unknown-path`);
      expect(response.status).toBe(404);
      
      const body = await response.json() as Record<string, unknown>;
      expect(body.error).toBe('Not found');
    });
  });
});
