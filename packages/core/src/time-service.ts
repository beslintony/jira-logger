import type { TimeEntry } from '@jira-logger/parsers';
import type { GroupedEntries, TaskEntry, TimeStats, RoundingRule } from './types.js';

/**
 * Service for processing and grouping time entries
 */
export class TimeEntryService {
  /**
   * Group time entries by date (YYYY-MM-DD)
   */
  groupByDate(entries: TimeEntry[]): GroupedEntries {
    const grouped: GroupedEntries = {};

    for (const entry of entries) {
      const date = entry.start.split('T')[0] ?? '';
      
      if (!date) continue;
      
      if (!grouped[date]) {
        grouped[date] = [];
      }

      // Find existing task entry or create new one
      let taskEntry = grouped[date].find(t => t.taskId === entry.taskId);
      
      if (!taskEntry) {
        taskEntry = {
          taskId: entry.taskId,
          taskName: entry.taskName,
          totalDuration: 0,
          entries: [],
        };
        grouped[date].push(taskEntry);
      }

      taskEntry.entries.push(entry);
      taskEntry.totalDuration += entry.duration;
    }

    // Sort dates in descending order
    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    const sorted: GroupedEntries = {};
    for (const date of sortedDates) {
      const entry = grouped[date];
      if (entry) {
        sorted[date] = entry;
      }
    }

    return sorted;
  }

  /**
   * Group time entries by task (across all dates)
   */
  groupByTask(entries: TimeEntry[]): Map<string, TaskEntry> {
    const tasks = new Map<string, TaskEntry>();

    for (const entry of entries) {
      let taskEntry = tasks.get(entry.taskId);
      
      if (!taskEntry) {
        taskEntry = {
          taskId: entry.taskId,
          taskName: entry.taskName,
          totalDuration: 0,
          entries: [],
        };
        tasks.set(entry.taskId, taskEntry);
      }

      taskEntry.entries.push(entry);
      taskEntry.totalDuration += entry.duration;
    }

    return tasks;
  }

  /**
   * Apply rounding rules to time entries
   */
  applyRounding(duration: number, rule: RoundingRule): number {
    let rounded = duration;

    // Convert to minutes, round, convert back to hours
    if (rule.roundToMinutes > 0) {
      const minutes = duration * 60;
      const roundedMinutes = Math.round(minutes / rule.roundToMinutes) * rule.roundToMinutes;
      rounded = roundedMinutes / 60;
    }

    // Apply minimum
    if (rule.minimumDuration !== undefined && rounded < rule.minimumDuration) {
      rounded = rule.minimumDuration;
    }

    // Apply maximum
    if (rule.maximumDuration !== undefined && rounded > rule.maximumDuration) {
      rounded = rule.maximumDuration;
    }

    return rounded;
  }

  /**
   * Format duration as Jira time string (e.g., "2h 30m")
   */
  formatDuration(duration: number): string {
    const hours = Math.floor(duration);
    const minutes = Math.round((duration - hours) * 60);

    if (hours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  /**
   * Find duplicate entries (same task, same day, overlapping times)
   */
  findDuplicates(entries: TimeEntry[]): Array<{ entry1: TimeEntry; entry2: TimeEntry }> {
    const duplicates: Array<{ entry1: TimeEntry; entry2: TimeEntry }> = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const e1 = entries[i]!;
        const e2 = entries[j]!;

        // Check if same task and same day
        if (e1.taskId !== e2.taskId) continue;
        const d1 = e1.start.split('T')[0];
        const d2 = e2.start.split('T')[0];
        if (d1 !== d2) continue;

        // Check for time overlap
        const s1 = new Date(e1.start).getTime();
        const e1Time = new Date(e1.end).getTime();
        const s2 = new Date(e2.start).getTime();
        const e2Time = new Date(e2.end).getTime();

        if (s1 < e2Time && s2 < e1Time) {
          duplicates.push({ entry1: e1, entry2: e2 });
        }
      }
    }

    return duplicates;
  }

  /**
   * Calculate statistics for time entries
   */
  calculateStats(entries: TimeEntry[]): TimeStats {
    const entriesPerDay: Record<string, number> = {};
    const durationPerDay: Record<string, number> = {};
    const uniqueTasks = new Set<string>();
    let totalDuration = 0;

    for (const entry of entries) {
      const date = entry.start.split('T')[0] ?? '';
      if (!date) continue;
      
      entriesPerDay[date] = (entriesPerDay[date] ?? 0) + 1;
      durationPerDay[date] = (durationPerDay[date] ?? 0) + entry.duration;
      
      uniqueTasks.add(entry.taskId);
      totalDuration += entry.duration;
    }

    return {
      totalEntries: entries.length,
      totalDuration,
      entriesPerDay,
      durationPerDay,
      uniqueTasks: uniqueTasks.size,
    };
  }

  /**
   * Filter entries by date range
   */
  filterByDateRange(
    entries: TimeEntry[],
    startDate: Date,
    endDate: Date
  ): TimeEntry[] {
    const start = startDate.getTime();
    const end = endDate.getTime();

    return entries.filter(entry => {
      const entryTime = new Date(entry.start).getTime();
      return entryTime >= start && entryTime <= end;
    });
  }

  /**
   * Get unique dates from entries
   */
  getUniqueDates(entries: TimeEntry[]): string[] {
    const dates = new Set<string>();
    for (const entry of entries) {
      const date = entry.start.split('T')[0];
      if (date) {
        dates.add(date);
      }
    }
    return Array.from(dates).sort();
  }
}

/**
 * Create a new time entry service
 */
export function createTimeEntryService(): TimeEntryService {
  return new TimeEntryService();
}
