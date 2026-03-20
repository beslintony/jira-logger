import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import type {
  TimeEntry,
  TimeTrackingParser,
  ParserMetadata,
  ValidationResult,
  CSVParserOptions,
} from './types.js';

/**
 * CSV time tracking parser with configurable column mapping
 */
export class CSVParser implements TimeTrackingParser {
  readonly metadata: ParserMetadata = {
    name: 'csv',
    displayName: 'CSV (Generic)',
    supportedExtensions: ['.csv'],
    supportsApi: false,
    supportsFile: true,
  };

  private options: CSVParserOptions;

  constructor(options: CSVParserOptions) {
    this.options = options;
  }

  /**
   * Parse CSV file and extract time entries
   */
  async parse(source: string): Promise<TimeEntry[]> {
    const content = this.readSource(source);
    const { mapping } = this.options;

    // Parse CSV
    const parseResult = Papa.parse<Record<string, string>>(content, {
      header: this.options.header ?? true,
      delimiter: this.options.delimiter,
      skipEmptyLines: true,
      transform: (value) => value.trim(),
    });

    if (parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.map(e => e.message).join('; ');
      throw new Error(`CSV parse error: ${errorMessages}`);
    }

    const entries: TimeEntry[] = [];

    for (const row of parseResult.data) {
      try {
        const entry = this.parseRow(row, mapping);
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`Skipping row due to error: ${(error as Error).message}`);
      }
    }

    return entries;
  }

  /**
   * Validate CSV format
   */
  async validate(source: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const content = this.readSource(source);
      
      // Try parsing
      const parseResult = Papa.parse(content, {
        header: this.options.header ?? true,
        delimiter: this.options.delimiter,
      });

      if (parseResult.errors.length > 0) {
        errors.push(...parseResult.errors.map(e => `CSV Error: ${e.message}`));
      }

      // Check if required columns exist
      if (parseResult.data.length > 0 && this.options.header) {
        const firstRow = parseResult.data[0] as Record<string, string>;
        const columns = Object.keys(firstRow);
        const { mapping } = this.options;

        if (!columns.includes(mapping.taskName)) {
          errors.push(`Missing required column: ${mapping.taskName}`);
        }
        if (!columns.includes(mapping.startTime)) {
          errors.push(`Missing required column: ${mapping.startTime}`);
        }
        if (!columns.includes(mapping.endTime) && !mapping.duration) {
          errors.push(`Missing required column: ${mapping.endTime} (or provide duration column)`);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errors.push(`File not found: ${source}`);
      } else {
        errors.push(`Error: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse a single CSV row into a TimeEntry
   */
  private parseRow(row: Record<string, string>, mapping: CSVParserOptions['mapping']): TimeEntry | null {
    const taskName = row[mapping.taskName];
    if (!taskName) {
      return null;
    }

    // Parse dates
    const startStr = row[mapping.startTime];
    const endStr = mapping.endTime ? row[mapping.endTime] : undefined;
    const durationStr = mapping.duration ? row[mapping.duration] : undefined;

    if (!startStr) {
      throw new Error(`Missing start time for task: ${taskName}`);
    }

    const start = this.parseDate(startStr);
    
    let end: Date;
    let duration: number;

    if (endStr) {
      end = this.parseDate(endStr);
      duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    } else if (durationStr) {
      duration = this.parseDuration(durationStr);
      end = new Date(start.getTime() + duration * 60 * 60 * 1000);
    } else {
      throw new Error(`Missing end time or duration for task: ${taskName}`);
    }

    const entry: TimeEntry = {
      taskId: this.generateTaskId(taskName),
      taskName,
      start: start.toISOString(),
      end: end.toISOString(),
      duration,
    };

    const projectValue = mapping.project ? row[mapping.project] : undefined;
    if (projectValue) {
      entry.project = projectValue;
    }
    
    const descriptionValue = mapping.description ? row[mapping.description] : undefined;
    if (descriptionValue) {
      entry.description = descriptionValue;
    }
    
    const tagsValue = mapping.tags ? row[mapping.tags] : undefined;
    if (tagsValue) {
      entry.tags = this.parseTags(tagsValue);
    }

    return entry;
  }

  /**
   * Parse date string (handles various formats)
   */
  private parseDate(dateStr: string): Date {
    // Try ISO format first
    let date = new Date(dateStr);
    
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try custom format if specified
    if (this.options.mapping.dateFormat) {
      // Simple date format parsing (could be expanded)
      date = this.parseCustomDate(dateStr, this.options.mapping.dateFormat);
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Unable to parse date: ${dateStr}`);
    }

    return date;
  }

  /**
   * Parse custom date format (basic implementation)
   */
  private parseCustomDate(dateStr: string, format: string): Date {
    // This is a simplified implementation
    // For production, consider using a library like date-fns
    
    // Handle common formats
    const patterns: Record<string, RegExp> = {
      'YYYY-MM-DD HH:mm:ss': /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
      'DD/MM/YYYY HH:mm': /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/,
      'MM/DD/YYYY HH:mm': /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/,
    };

    const pattern = patterns[format];
    if (!pattern) {
      return new Date(dateStr); // Fallback
    }

    const match = pattern.exec(dateStr);
    if (!match) {
      return new Date(NaN);
    }

    // Parse based on format
    if (format === 'YYYY-MM-DD HH:mm:ss') {
      return new Date(
        parseInt(match[1]!),
        parseInt(match[2]!) - 1,
        parseInt(match[3]!),
        parseInt(match[4]!),
        parseInt(match[5]!),
        parseInt(match[6]!)
      );
    }

    return new Date(NaN);
  }

  /**
   * Parse duration string (handles "2h 30m", "2.5", "150m", etc.)
   */
  private parseDuration(durationStr: string): number {
    // Try decimal hours first
    const decimalMatch = /^(\d+(?:\.\d+)?)\s*h?$/i.exec(durationStr);
    if (decimalMatch?.[1]) {
      return parseFloat(decimalMatch[1]);
    }

    // Try "Xh Ym" format
    const hoursMatch = /(\d+)\s*h/i.exec(durationStr);
    const minutesMatch = /(\d+)\s*m/i.exec(durationStr);
    
    let hours = 0;
    let minutes = 0;

    if (hoursMatch?.[1]) {
      hours = parseInt(hoursMatch[1]);
    }
    if (minutesMatch?.[1]) {
      minutes = parseInt(minutesMatch[1]);
    }

    if (hours === 0 && minutes === 0) {
      // Try just minutes
      const justMinutes = /^(\d+)\s*$/.exec(durationStr);
      if (justMinutes?.[1]) {
        minutes = parseInt(justMinutes[1]);
      }
    }

    return hours + minutes / 60;
  }

  /**
   * Generate a task ID from task name
   */
  private generateTaskId(taskName: string): string {
    // Simple hash for task ID
    let hash = 0;
    for (let i = 0; i < taskName.length; i++) {
      const char = taskName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `task_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Parse tags from string (comma or semicolon separated)
   */
  private parseTags(tagsStr: string): string[] {
    return tagsStr
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  /**
   * Read source - either file path or direct content
   */
  private readSource(source: string): string {
    if (source.endsWith('.csv') || source.includes('/')) {
      return readFileSync(source, 'utf-8');
    }
    return source;
  }
}

/**
 * Create a new CSV parser instance
 */
export function createCSVParser(options: CSVParserOptions): CSVParser {
  return new CSVParser(options);
}
