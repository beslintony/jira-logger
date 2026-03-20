import type { TimeEntry } from '@jira-logger/parsers';
import type { JiraClient, LogWorkOptions } from '@jira-logger/jira-api';
import type { 
  TaskEntry, 
  LogPreview, 
  LogResult, 
  TaskMapping,
  RoundingRule,
} from './types.js';
import type { TimeEntryService } from './time-service.js';
import type { TicketMatcher } from './ticket-matcher.js';

/**
 * Service for logging work to Jira
 */
export class WorkLogService {
  private jiraClient: JiraClient;
  private timeService: TimeEntryService;
  private ticketMatcher: TicketMatcher;

  constructor(
    jiraClient: JiraClient,
    timeService: TimeEntryService,
    ticketMatcher: TicketMatcher
  ) {
    this.jiraClient = jiraClient;
    this.timeService = timeService;
    this.ticketMatcher = ticketMatcher;
  }

  /**
   * Preview what work would be logged
   */
  async preview(
    entries: TaskEntry[],
    options: {
      roundingRule?: RoundingRule;
      defaultComment?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<LogPreview[]> {
    const previews: LogPreview[] = [];

    for (const entry of entries) {
      // Get or find matching issue
      let issueKey = entry.matchedIssue?.key;
      
      if (!issueKey) {
        const matches = await this.ticketMatcher.match(entry.taskName);
        const firstMatch = matches[0];
        if (firstMatch) {
          issueKey = firstMatch.issue.key;
        }
      }

      if (!issueKey) {
        continue;
      }

      // Apply rounding
      const duration = options.roundingRule
        ? this.timeService.applyRounding(entry.totalDuration, options.roundingRule)
        : entry.totalDuration;

      // Generate comment
      const comment = this.generateComment(
        entry.taskName,
        this.timeService.formatDuration(duration),
        options.defaultComment
      );

      const firstEntry = entry.entries[0];
      const dateStr = firstEntry?.start.split('T')[0] ?? '';

      previews.push({
        date: dateStr,
        issueKey,
        taskName: entry.taskName,
        timeSpent: this.timeService.formatDuration(duration),
        comment,
        isNew: !entry.matchedIssue,
      });
    }

    return previews;
  }

  /**
   * Log work for multiple entries
   */
  async logMultiple(
    entries: TaskEntry[],
    options: {
      roundingRule?: RoundingRule;
      defaultComment?: string;
      onProgress?: (result: LogResult) => void;
    } = {}
  ): Promise<LogResult[]> {
    const results: LogResult[] = [];

    for (const entry of entries) {
      const result = await this.logSingle(entry, options);
      results.push(result);
      
      if (options.onProgress) {
        options.onProgress(result);
      }
    }

    return results;
  }

  /**
   * Log work for a single entry
   */
  async logSingle(
    entry: TaskEntry,
    options: {
      roundingRule?: RoundingRule;
      defaultComment?: string;
      issueKey?: string;
    } = {}
  ): Promise<LogResult> {
    // Determine issue key
    let issueKey = options.issueKey ?? entry.matchedIssue?.key;

    if (!issueKey) {
      const matches = await this.ticketMatcher.match(entry.taskName);
      const firstMatch = matches[0];
      if (!firstMatch) {
        return {
          success: false,
          issueKey: '',
          timeSpent: '',
          error: `No matching issue found for task: ${entry.taskName}`,
        };
      }
      issueKey = firstMatch.issue.key;
    }

    // Apply rounding
    const duration = options.roundingRule
      ? this.timeService.applyRounding(entry.totalDuration, options.roundingRule)
      : entry.totalDuration;

    const timeSpent = this.timeService.formatDuration(duration);

    // Generate comment
    const comment = this.generateComment(
      entry.taskName,
      timeSpent,
      options.defaultComment
    );

    // Calculate start time (midday of the entry date)
    const firstEntry = entry.entries[0];
    const entryDate = firstEntry?.start ?? new Date().toISOString();
    const date = entryDate.split('T')[0] ?? new Date().toISOString().split('T')[0];
    const started = `${date}T12:00:00.000+0000`;

    try {
      const workLog = await this.jiraClient.logWork({
        issueKey,
        timeSpent,
        started,
        comment,
      });

      // Save mapping for future use
      this.ticketMatcher.saveMapping(entry.taskName, issueKey);

      const result: LogResult = {
        success: true,
        issueKey,
        timeSpent,
      };
      if (workLog.id) {
        result.workLogId = workLog.id;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        issueKey,
        timeSpent,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate work log comment
   */
  private generateComment(
    taskName: string,
    timeSpent: string,
    template?: string
  ): string {
    const defaultTemplate = 'Worked on "{taskName}" for {timeSpent}';
    const tpl = template ?? defaultTemplate;

    // Remove ticket ID from task name for cleaner comment
    const cleanTaskName = taskName.replace(/\b[A-Z][A-Z0-9_]*-\d+\b/, '').trim();

    return tpl
      .replace(/{taskName}/g, cleanTaskName)
      .replace(/{timeSpent}/g, timeSpent);
  }

  /**
   * Get saved mappings
   */
  getMappings(): TaskMapping[] {
    return this.ticketMatcher.getMappings();
  }

  /**
   * Validate all saved mappings
   */
  async validateMappings(): Promise<{
    valid: TaskMapping[];
    invalid: TaskMapping[];
  }> {
    return this.ticketMatcher.validateMappings();
  }
}

/**
 * Create a new work log service
 */
export function createWorkLogService(
  jiraClient: JiraClient,
  timeService: TimeEntryService,
  ticketMatcher: TicketMatcher
): WorkLogService {
  return new WorkLogService(jiraClient, timeService, ticketMatcher);
}
