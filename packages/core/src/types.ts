import type { TimeEntry } from '@jira-logger/parsers';
import type { JiraIssue } from '@jira-logger/jira-api';

/**
 * Grouped time entries by date
 */
export interface GroupedEntries {
  [date: string]: TaskEntry[];
}

/**
 * Task entry with aggregated time
 */
export interface TaskEntry {
  /** Task ID */
  taskId: string;
  
  /** Task name */
  taskName: string;
  
  /** Total duration in hours */
  totalDuration: number;
  
  /** Individual time entries */
  entries: TimeEntry[];
  
  /** Associated Jira issue (if matched) */
  matchedIssue?: JiraIssue;
  
  /** Match confidence (0-1) */
  matchConfidence?: number;
}

/**
 * Match result for a task
 */
export interface MatchResult {
  /** Matched Jira issue */
  issue: JiraIssue;
  
  /** Match confidence score (0-1) */
  confidence: number;
  
  /** Match reason/description */
  reason: string;
}

/**
 * Rounding rule configuration
 */
export interface RoundingRule {
  /** Round to nearest N minutes */
  roundToMinutes: number;
  
  /** Minimum duration to log (in hours) */
  minimumDuration?: number;
  
  /** Maximum duration per entry (in hours) */
  maximumDuration?: number;
}

/**
 * Time statistics
 */
export interface TimeStats {
  /** Total entries */
  totalEntries: number;
  
  /** Total duration in hours */
  totalDuration: number;
  
  /** Entries per day */
  entriesPerDay: Record<string, number>;
  
  /** Duration per day */
  durationPerDay: Record<string, number>;
  
  /** Unique tasks */
  uniqueTasks: number;
}

/**
 * Preview of work to be logged
 */
export interface LogPreview {
  /** Date */
  date: string;
  
  /** Issue key */
  issueKey: string;
  
  /** Task name */
  taskName: string;
  
  /** Time spent (formatted) */
  timeSpent: string;
  
  /** Comment */
  comment: string;
  
  /** Whether this would be a new entry */
  isNew: boolean;
}

/**
 * Result of logging work
 */
export interface LogResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Issue key */
  issueKey: string;
  
  /** Time spent */
  timeSpent: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Work log ID (if successful) */
  workLogId?: string;
}

/**
 * Task-to-issue mapping for persistence
 */
export interface TaskMapping {
  /** Task name pattern */
  taskName: string;
  
  /** Jira issue key */
  issueKey: string;
  
  /** When this mapping was created/updated */
  lastUsed: string;
  
  /** How many times this mapping has been used */
  useCount: number;
}

/**
 * Stored mappings data
 */
export interface MappingsData {
  /** Task-to-issue mappings */
  mappings: TaskMapping[];
  
  /** Last sync timestamp */
  lastSync: string;
}
