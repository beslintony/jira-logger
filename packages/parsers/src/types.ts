/**
 * Represents a single time entry parsed from any source
 */
export interface TimeEntry {
  /** Unique identifier for the task */
  taskId: string;
  
  /** Human-readable task name */
  taskName: string;
  
  /** Start time in ISO 8601 format */
  start: string;
  
  /** End time in ISO 8601 format */
  end: string;
  
  /** Duration in hours */
  duration: number;
  
  /** Optional tags/labels */
  tags?: string[];
  
  /** Optional project identifier */
  project?: string;
  
  /** Optional description */
  description?: string;
}

/**
 * Parser metadata for identification
 */
export interface ParserMetadata {
  /** Parser name (e.g., 'grindstone', 'toggl') */
  name: string;
  
  /** Human-readable display name */
  displayName: string;
  
  /** Supported file extensions */
  supportedExtensions: string[];
  
  /** Whether this parser supports API access */
  supportsApi: boolean;
  
  /** Whether this parser supports file input */
  supportsFile: boolean;
}

/**
 * Validation result for parser input
 */
export interface ValidationResult {
  /** Whether the input is valid */
  valid: boolean;
  
  /** Error messages if invalid */
  errors: string[];
}

/**
 * Parser interface that all time tracking parsers must implement
 */
export interface TimeTrackingParser {
  /** Parser metadata */
  readonly metadata: ParserMetadata;
  
  /**
   * Parse time entries from source
   * @param source - File path, CSV content, or API response
   */
  parse(source: string): Promise<TimeEntry[]>;
  
  /**
   * Validate if the source can be parsed
   * @param source - Source to validate
   */
  validate(source: string): Promise<ValidationResult>;
}

/**
 * CSV column mapping configuration
 */
export interface CSVMapping {
  /** Column name for task name */
  taskName: string;
  
  /** Column name for start time */
  startTime: string;
  
  /** Column name for end time */
  endTime: string;
  
  /** Optional column name for duration (if not calculated from start/end) */
  duration?: string;
  
  /** Optional column name for project */
  project?: string;
  
  /** Optional column name for tags */
  tags?: string;
  
  /** Optional column name for description */
  description?: string;
  
  /** Date format string for parsing (e.g., 'YYYY-MM-DD HH:mm:ss') */
  dateFormat?: string;
}

/**
 * Parser options for CSV parser
 */
export interface CSVParserOptions {
  /** Column mapping configuration */
  mapping: CSVMapping;
  
  /** CSV delimiter (default: auto-detect) */
  delimiter?: string;
  
  /** Whether CSV has header row */
  header?: boolean;
  
  /** Timezone for date parsing */
  timezone?: string;
}
