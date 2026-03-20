/**
 * Ticket template definitions for creating Jira issues
 */

export interface TicketTemplate {
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Issue type (e.g., 'Task', 'Story', 'Bug') */
  issueType: string;
  
  /** Project key (optional, uses default if not specified) */
  projectKey?: string;
  
  /** Summary template (supports placeholders) */
  summaryTemplate: string;
  
  /** Description template (supports placeholders) */
  descriptionTemplate: string;
  
  /** Priority (optional) */
  priority?: string;
  
  /** Labels to apply */
  labels?: string[];
  
  /** Components */
  components?: string[];
  
  /** Custom fields */
  customFields?: Record<string, unknown>;
}

/**
 * Placeholder values for template substitution
 */
export interface TemplateContext {
  /** Original task name from time tracking */
  taskName: string;
  
  /** Date of the time entry */
  date: string;
  
  /** Duration in hours */
  duration: number;
  
  /** Formatted duration string */
  durationFormatted: string;
  
  /** Task ID */
  taskId: string;
  
  /** Current date */
  currentDate: string;
  
  /** User name (if available) */
  userName?: string;
}

/**
 * Built-in default templates
 */
export const defaultTemplates: TicketTemplate[] = [
  {
    name: 'task',
    description: 'General task template',
    issueType: 'Task',
    summaryTemplate: '{taskName}',
    descriptionTemplate: `Time tracked: {durationFormatted}
Date: {date}

Original task: {taskName}`,
    labels: ['time-tracked'],
  },
  {
    name: 'development',
    description: 'Development work template',
    issueType: 'Task',
    summaryTemplate: '{taskName}',
    descriptionTemplate: `## Development Work

**Time Spent:** {durationFormatted}
**Date:** {date}

### Task
{taskName}

### Notes
- Work tracked via jira-time-logger
- Created on {currentDate}`,
    labels: ['development', 'time-tracked'],
  },
  {
    name: 'meeting',
    description: 'Meeting or discussion template',
    issueType: 'Task',
    summaryTemplate: '{taskName}',
    descriptionTemplate: `## Meeting

**Duration:** {durationFormatted}
**Date:** {date}

### Attendees
- {userName}

### Notes
Meeting time tracked via jira-time-logger.`,
    labels: ['meeting', 'time-tracked'],
  },
  {
    name: 'bug',
    description: 'Bug fix template',
    issueType: 'Bug',
    summaryTemplate: '[Bug] {taskName}',
    descriptionTemplate: `## Bug Fix

**Time Invested:** {durationFormatted}
**Date:** {date}

### Description
{taskName}

### Fix Details
Bug fix work tracked via jira-time-logger.`,
    labels: ['bug', 'time-tracked'],
    priority: 'Medium',
  },
  {
    name: 'research',
    description: 'Research or investigation template',
    issueType: 'Story',
    summaryTemplate: '[Research] {taskName}',
    descriptionTemplate: `## Research / Investigation

**Time Spent:** {durationFormatted}
**Date:** {date}

### Research Topic
{taskName}

### Findings
Research work tracked via jira-time-logger.`,
    labels: ['research', 'time-tracked'],
  },
];

/**
 * Substitute placeholders in template string
 */
export function substituteTemplate(
  template: string,
  context: TemplateContext
): string {
  return template
    .replace(/{taskName}/g, context.taskName)
    .replace(/{date}/g, context.date)
    .replace(/{duration}/g, context.duration.toString())
    .replace(/{durationFormatted}/g, context.durationFormatted)
    .replace(/{taskId}/g, context.taskId)
    .replace(/{currentDate}/g, context.currentDate)
    .replace(/{userName}/g, context.userName || 'Unknown');
}

/**
 * Create a Jira issue payload from template
 */
export function createIssueFromTemplate(
  template: TicketTemplate,
  context: TemplateContext,
  defaultProject: string
): {
  fields: {
    project: { key: string };
    issuetype: { name: string };
    summary: string;
    description?: string;
    priority?: { name: string };
    labels?: string[];
    components?: { name: string }[];
    [key: string]: unknown;
  };
} {
  const summary = substituteTemplate(template.summaryTemplate, context);
  const description = substituteTemplate(template.descriptionTemplate, context);
  
  const payload: {
    fields: {
      project: { key: string };
      issuetype: { name: string };
      summary: string;
      description?: string;
      priority?: { name: string };
      labels?: string[];
      components?: { name: string }[];
      [key: string]: unknown;
    };
  } = {
    fields: {
      project: { key: template.projectKey || defaultProject },
      issuetype: { name: template.issueType },
      summary: summary.length > 255 ? summary.slice(0, 252) + '...' : summary,
    },
  };
  
  if (description) {
    payload.fields.description = description;
  }
  
  if (template.priority) {
    payload.fields.priority = { name: template.priority };
  }
  
  if (template.labels && template.labels.length > 0) {
    payload.fields.labels = template.labels;
  }
  
  if (template.components && template.components.length > 0) {
    payload.fields.components = template.components.map(name => ({ name }));
  }
  
  if (template.customFields) {
    Object.assign(payload.fields, template.customFields);
  }
  
  return payload;
}

/**
 * Find template by name (case-insensitive)
 */
export function findTemplate(
  templates: TicketTemplate[],
  name: string
): TicketTemplate | undefined {
  return templates.find(
    t => t.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get template names list
 */
export function getTemplateNames(templates: TicketTemplate[]): string[] {
  return templates.map(t => t.name);
}
