import { z } from 'zod';

/**
 * Jira configuration schema
 */
export const jiraConfigSchema = z.object({
  baseUrl: z.string().url().describe('Jira instance URL (e.g., https://company.atlassian.net)'),
  username: z.string().email().describe('Jira username (email address)'),
  apiToken: z.string().min(1).describe('Jira API token'),
  defaultProject: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Project key must be uppercase letters/numbers/underscores').describe('Default project key'),
});

export type JiraConfig = z.infer<typeof jiraConfigSchema>;

/**
 * Time rounding configuration schema
 */
export const timeRoundingSchema = z.object({
  enabled: z.boolean().default(false),
  roundToMinutes: z.number().int().min(1).max(60).default(15).describe('Round to nearest N minutes'),
});

export type TimeRoundingConfig = z.infer<typeof timeRoundingSchema>;

/**
 * Time tracking source configuration schema
 */
export const timeTrackingSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('grindstone'),
    path: z.string().describe('Path to .gsjbd file'),
  }),
  z.object({
    type: z.literal('toggl'),
    apiToken: z.string().optional().describe('Toggl API token'),
    workspaceId: z.string().optional().describe('Toggl workspace ID'),
    path: z.string().optional().describe('Path to CSV export (if using file)'),
  }),
  z.object({
    type: z.literal('clockify'),
    apiKey: z.string().optional().describe('Clockify API key'),
    workspaceId: z.string().optional().describe('Clockify workspace ID'),
    path: z.string().optional().describe('Path to CSV export (if using file)'),
  }),
  z.object({
    type: z.literal('csv'),
    path: z.string().describe('Path to CSV file'),
    mapping: z.object({
      taskName: z.string().default('task'),
      startTime: z.string().default('start'),
      endTime: z.string().default('end'),
      duration: z.string().optional(),
    }).describe('Column mapping for CSV'),
  }),
]);

export type TimeTrackingSource = z.infer<typeof timeTrackingSourceSchema>;

/**
 * Comment template configuration schema
 */
export const commentTemplateSchema = z.object({
  default: z.string().default('Worked on "{taskName}" for {timeSpent}'),
  templates: z.record(z.string()).default({}),
});

export type CommentTemplateConfig = z.infer<typeof commentTemplateSchema>;

/**
 * Main configuration schema
 */
export const configSchema = z.object({
  version: z.literal('2.0.0').default('2.0.0'),
  jira: jiraConfigSchema,
  timeRounding: timeRoundingSchema.default({}),
  sources: z.array(timeTrackingSourceSchema).min(1).describe('Time tracking sources'),
  commentTemplate: commentTemplateSchema.default({}),
  appearance: z.object({
    dateFormat: z.enum(['iso', 'locale', 'relative']).default('iso'),
  }).default({}),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Partial config for updates (all fields optional)
 */
export const partialConfigSchema = configSchema.partial();

export type PartialConfig = z.infer<typeof partialConfigSchema>;

/**
 * Validation result type
 */
export interface ValidationResult {
  success: boolean;
  errors: z.ZodError | null;
  data: Config | null;
}
