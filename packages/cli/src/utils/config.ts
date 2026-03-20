import { createConfigManager } from '@jira-logger/config';

let globalConfigPath: string | undefined;

/**
 * Set the global configuration path
 */
export function setGlobalConfigPath(path: string): void {
  globalConfigPath = path;
}

/**
 * Get the global configuration path
 */
export function getGlobalConfigPath(): string | undefined {
  return globalConfigPath;
}

/**
 * Create a config manager with the global path if set
 */
export function createGlobalConfigManager() {
  return createConfigManager(globalConfigPath);
}
