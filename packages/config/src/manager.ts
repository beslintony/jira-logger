import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { envPaths } from 'env-paths';
import type { Config, PartialConfig, ValidationResult } from './schemas.js';
import { configSchema } from './schemas.js';

const APP_NAME = 'jira-time-logger';

/**
 * Default configuration values
 */
const defaultConfig: Config = {
  version: '2.0.0',
  jira: {
    baseUrl: '',
    username: '',
    apiToken: '',
    defaultProject: '',
  },
  timeRounding: {
    enabled: false,
    roundToMinutes: 15,
  },
  sources: [],
  commentTemplate: {
    default: 'Worked on "{taskName}" for {timeSpent}',
    templates: {},
  },
  appearance: {
    dateFormat: 'iso',
  },
};

/**
 * Configuration manager for reading, writing, and validating config
 */
export class ConfigManager {
  private configPath: string;
  private config: Config | null = null;

  constructor(customPath?: string) {
    const paths = envPaths(APP_NAME);
    this.configPath = customPath ?? join(paths.config, 'config.json');
  }

  /**
   * Get the path to the configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load configuration from file or return defaults
   */
  load(): Config {
    if (this.config) {
      return this.config;
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(content) as unknown;
      
      const result = this.validate(loadedConfig);
      
      if (result.success && result.data) {
        this.config = result.data;
        return result.data;
      }
      
      console.warn('Invalid config file, using defaults');
      return defaultConfig;
    } catch {
      // File doesn't exist or is invalid
      return defaultConfig;
    }
  }

  /**
   * Save configuration to file
   */
  save(config: Config): void {
    // Ensure directory exists
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Validate before saving
    const result = this.validate(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.errors?.message ?? 'Unknown error'}`);
    }

    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.config = config;
  }

  /**
   * Update configuration with partial data
   */
  update(updates: PartialConfig): Config {
    const current = this.load();
    const merged = this.mergeConfigs(current, updates);
    this.save(merged);
    return merged;
  }

  /**
   * Validate configuration object
   */
  validate(data: unknown): ValidationResult {
    const result = configSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        errors: null,
        data: result.data,
      };
    }
    
    return {
      success: false,
      errors: result.error,
      data: null,
    };
  }

  /**
   * Check if configuration is complete (has all required fields)
   */
  isComplete(config?: Config): boolean {
    const cfg = config ?? this.load();
    
    return (
      cfg.jira.baseUrl.length > 0 &&
      cfg.jira.username.length > 0 &&
      cfg.jira.apiToken.length > 0 &&
      cfg.jira.defaultProject.length > 0 &&
      cfg.sources.length > 0
    );
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.save(defaultConfig);
  }

  /**
   * Clear cached config (force reload on next access)
   */
  clearCache(): void {
    this.config = null;
  }

  /**
   * Merge partial config into existing config
   */
  private mergeConfigs(current: Config, updates: PartialConfig): Config {
    return {
      ...current,
      ...updates,
      jira: {
        ...current.jira,
        ...updates.jira,
      },
      timeRounding: {
        ...current.timeRounding,
        ...updates.timeRounding,
      },
      sources: updates.sources ?? current.sources,
      commentTemplate: {
        ...current.commentTemplate,
        ...updates.commentTemplate,
      },
      appearance: {
        ...current.appearance,
        ...updates.appearance,
      },
    };
  }
}

/**
 * Create a config manager instance
 */
export function createConfigManager(customPath?: string): ConfigManager {
  return new ConfigManager(customPath);
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  return { ...defaultConfig };
}
