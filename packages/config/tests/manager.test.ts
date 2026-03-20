import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigManager, getDefaultConfig } from '../src/index.js';
import type { Config } from '../src/index.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'jira-logger-test-'));
    configManager = new ConfigManager(join(tempDir, 'config.json'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return default config when file does not exist', () => {
      const config = configManager.load();
      const defaults = getDefaultConfig();

      expect(config.version).toBe(defaults.version);
      expect(config.jira.baseUrl).toBe('');
    });

    it('should load existing config file', () => {
      const testConfig = {
        version: '2.0.0',
        jira: {
          baseUrl: 'https://test.atlassian.net',
          username: 'test@example.com',
          apiToken: 'test-token',
          defaultProject: 'TEST',
        },
        timeRounding: { enabled: false, roundToMinutes: 15 },
        sources: [{ type: 'grindstone', path: '/path/to/file.gsjbd' }],
        commentTemplate: { default: 'Test', templates: {} },
        appearance: { dateFormat: 'iso' },
      };

      const { writeFileSync } = require('node:fs');
      writeFileSync(join(tempDir, 'config.json'), JSON.stringify(testConfig), 'utf-8');
      configManager.clearCache();

      const config = configManager.load();
      expect(config.jira.baseUrl).toBe('https://test.atlassian.net');
      expect(config.jira.username).toBe('test@example.com');
    });
  });

  describe('save', () => {
    it('should save config to file', () => {
      const config = getDefaultConfig();
      config.jira.baseUrl = 'https://saved.atlassian.net';
      config.jira.username = 'test@example.com';
      config.jira.apiToken = 'test-token';
      config.jira.defaultProject = 'TEST';
      config.sources = [{ type: 'grindstone', path: '/test.gsjbd' }];

      configManager.save(config);

      const savedContent = readFileSync(join(tempDir, 'config.json'), 'utf-8');
      const saved = JSON.parse(savedContent);

      expect(saved.jira.baseUrl).toBe('https://saved.atlassian.net');
    });

    it('should throw on invalid config', () => {
      const invalidConfig = {
        version: '2.0.0',
        jira: {
          baseUrl: 'not-a-url',
          username: '',
          apiToken: '',
          defaultProject: '',
        },
        timeRounding: { enabled: false, roundToMinutes: 15 },
        sources: [],
        commentTemplate: { default: '', templates: {} },
        appearance: { dateFormat: 'iso' },
      };

      expect(() => configManager.save(invalidConfig as Config)).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate correct config', () => {
      const validConfig = getDefaultConfig();
      validConfig.jira.baseUrl = 'https://valid.atlassian.net';
      validConfig.jira.username = 'valid@example.com';
      validConfig.jira.apiToken = 'token';
      validConfig.jira.defaultProject = 'PROJ';
      validConfig.sources = [{ type: 'grindstone', path: '/test.gsjbd' }];

      const result = configManager.validate(validConfig);

      expect(result.success).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.data).not.toBeNull();
    });

    it('should reject invalid URL', () => {
      const invalidConfig = {
        ...getDefaultConfig(),
        jira: {
          ...getDefaultConfig().jira,
          baseUrl: 'not-a-url',
        },
      };

      const result = configManager.validate(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });

  describe('isComplete', () => {
    it('should return false for default config', () => {
      expect(configManager.isComplete()).toBe(false);
    });

    it('should return true for complete config', () => {
      const completeConfig = getDefaultConfig();
      completeConfig.jira.baseUrl = 'https://test.atlassian.net';
      completeConfig.jira.username = 'test@example.com';
      completeConfig.jira.apiToken = 'token';
      completeConfig.jira.defaultProject = 'TEST';
      completeConfig.sources = [{ type: 'grindstone', path: '/test.gsjbd' }];

      expect(configManager.isComplete(completeConfig)).toBe(true);
    });
  });
});
