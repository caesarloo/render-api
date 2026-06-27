import { t } from '../i18n';

describe('i18n', () => {
  describe('t()', () => {
    it('returns Chinese text for known key with zh', () => {
      expect(t('plugin.name', 'zh')).toBe('Render API');
    });

    it('returns English text for known key with en', () => {
      expect(t('plugin.name', 'en')).toBe('Render API');
    });

    it('returns Chinese by default when language is omitted', () => {
      expect(t('server.running')).toBe('运行中');
    });

    it('returns the key string for unknown keys', () => {
      expect(t('nonexistent.key', 'en')).toBe('nonexistent.key');
      expect(t('nonexistent.key', 'zh')).toBe('nonexistent.key');
    });

    it('returns correct Chinese server status text', () => {
      expect(t('server.running', 'zh')).toBe('运行中');
      expect(t('server.stopped', 'zh')).toBe('已停止');
      expect(t('server.start', 'zh')).toBe('启动服务');
      expect(t('server.stop', 'zh')).toBe('停止服务');
    });

    it('returns correct English server status text', () => {
      expect(t('server.running', 'en')).toBe('Running');
      expect(t('server.stopped', 'en')).toBe('Stopped');
      expect(t('server.start', 'en')).toBe('Start Server');
      expect(t('server.stop', 'en')).toBe('Stop Server');
    });

    it('returns correct setting labels in Chinese', () => {
      expect(t('setting.serverPort', 'zh')).toBe('服务器端口');
      expect(t('setting.enableDataview', 'zh')).toBe('启用 Dataview 渲染');
      expect(t('setting.apiKey', 'zh')).toBe('API 密钥');
    });

    it('returns correct setting labels in English', () => {
      expect(t('setting.serverPort', 'en')).toBe('Server Port');
      expect(t('setting.enableDataview', 'en')).toBe('Enable Dataview Rendering');
    });
  });
});
