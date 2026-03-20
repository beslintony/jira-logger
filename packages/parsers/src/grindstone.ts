import { readFileSync } from 'node:fs';
import type {
  TimeEntry,
  TimeTrackingParser,
  ParserMetadata,
  ValidationResult,
} from './types.js';

/**
 * Grindstone time tracking file format (.gsjbd)
 * JSON format with:
 * - f.t: Array of tasks with i (id) and n (name)
 * - f.r: Array of time records with t (task id), s (start), e (end)
 */
interface GrindstoneTask {
  i: string;
  n: string;
}

interface GrindstoneRecord {
  t: string;
  s: string;
  e: string;
}

interface GrindstoneFile {
  f: {
    t: GrindstoneTask[];
    r: GrindstoneRecord[];
  };
}

/**
 * Parser for Grindstone time tracking files (.gsjbd)
 */
export class GrindstoneParser implements TimeTrackingParser {
  readonly metadata: ParserMetadata = {
    name: 'grindstone',
    displayName: 'Grindstone',
    supportedExtensions: ['.gsjbd'],
    supportsApi: false,
    supportsFile: true,
  };

  /**
   * Parse a Grindstone file and extract time entries
   */
  async parse(source: string): Promise<TimeEntry[]> {
    const content = this.readSource(source);
    const data = this.parseJSON(content);
    
    // Create a map of task IDs to task names
    const taskMap = new Map<string, string>();
    for (const task of data.f.t) {
      taskMap.set(task.i, task.n);
    }

    // Parse time records
    const entries: TimeEntry[] = [];
    for (const record of data.f.r) {
      const start = new Date(record.s);
      const end = new Date(record.e);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn(`Invalid date in record: ${JSON.stringify(record)}`);
        continue;
      }

      const durationMs = end.getTime() - start.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      entries.push({
        taskId: record.t,
        taskName: taskMap.get(record.t) ?? 'Unknown Task',
        start: start.toISOString(),
        end: end.toISOString(),
        duration: durationHours,
      });
    }

    return entries;
  }

  /**
   * Validate if the source is a valid Grindstone file
   */
  async validate(source: string): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      const content = this.readSource(source);
      const data = this.parseJSON(content);

      // Check required structure
      if (!data.f) {
        errors.push("Missing 'f' property in root");
      } else {
        if (!Array.isArray(data.f.t)) {
          errors.push("Missing or invalid 'f.t' (tasks array)");
        }
        if (!Array.isArray(data.f.r)) {
          errors.push("Missing or invalid 'f.r' (records array)");
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push(`Invalid JSON: ${error.message}`);
      } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errors.push(`File not found: ${source}`);
      } else {
        errors.push(`Error reading file: ${(error as Error).message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Read source - either file path or direct content
   */
  private readSource(source: string): string {
    // If it looks like a file path, read it
    if (source.endsWith('.gsjbd') || source.includes('/')) {
      return readFileSync(source, 'utf-8');
    }
    // Otherwise assume it's JSON content
    return source;
  }

  /**
   * Parse JSON content with validation
   */
  private parseJSON(content: string): GrindstoneFile {
    const parsed = JSON.parse(content) as unknown;
    
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Invalid JSON: expected object');
    }

    return parsed as GrindstoneFile;
  }
}

/**
 * Create a new Grindstone parser instance
 */
export function createGrindstoneParser(): GrindstoneParser {
  return new GrindstoneParser();
}
