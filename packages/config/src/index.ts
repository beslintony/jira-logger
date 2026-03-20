// Export schemas and types
export {
  jiraConfigSchema,
  timeRoundingSchema,
  timeTrackingSourceSchema,
  commentTemplateSchema,
  configSchema,
  partialConfigSchema,
} from './schemas.js';
export type {
  JiraConfig,
  TimeRoundingConfig,
  TimeTrackingSource,
  CommentTemplateConfig,
  Config,
  PartialConfig,
  ValidationResult,
} from './schemas.js';

// Export manager
export { ConfigManager, createConfigManager, getDefaultConfig } from './manager.js';
