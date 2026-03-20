import { describe, it, expect } from 'vitest';
import { createTimeEntryService } from '../src/index.js';
import type { TimeEntry } from '@jira-logger/parsers';

describe('TimeEntryService', () => {
  const service = createTimeEntryService();

  describe('groupByDate', () => {
    it('should group entries by date', () => {
      const entries: TimeEntry[] = [
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T10:00:00Z',
          duration: 1,
        },
        {
          taskId: 'task2',
          taskName: 'Task 2',
          start: '2024-01-15T11:00:00Z',
          end: '2024-01-15T12:00:00Z',
          duration: 1,
        },
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-16T09:00:00Z',
          end: '2024-01-16T10:30:00Z',
          duration: 1.5,
        },
      ];

      const grouped = service.groupByDate(entries);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['2024-01-15']).toHaveLength(2);
      expect(grouped['2024-01-16']).toHaveLength(1);
      expect(grouped['2024-01-16']?.[0]?.totalDuration).toBe(1.5);
    });

    it('should aggregate durations for same task on same day', () => {
      const entries: TimeEntry[] = [
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T10:00:00Z',
          duration: 1,
        },
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T14:00:00Z',
          end: '2024-01-15T15:00:00Z',
          duration: 1,
        },
      ];

      const grouped = service.groupByDate(entries);

      expect(grouped['2024-01-15']).toHaveLength(1);
      expect(grouped['2024-01-15']?.[0]?.totalDuration).toBe(2);
    });
  });

  describe('formatDuration', () => {
    it('should format hours only', () => {
      expect(service.formatDuration(2)).toBe('2h');
    });

    it('should format minutes only', () => {
      expect(service.formatDuration(0.5)).toBe('30m');
    });

    it('should format hours and minutes', () => {
      expect(service.formatDuration(2.5)).toBe('2h 30m');
    });
  });

  describe('applyRounding', () => {
    it('should round to nearest 15 minutes', () => {
      const rule = { roundToMinutes: 15 };
      // 1.1 hours = 66 minutes -> rounds to 60 minutes = 1 hour
      expect(service.applyRounding(1.1, rule)).toBeCloseTo(1.0, 2);
      // 1.2 hours = 72 minutes -> rounds to 75 minutes = 1.25 hours
      expect(service.applyRounding(1.2, rule)).toBeCloseTo(1.25, 2);
      // 1.3 hours = 78 minutes -> rounds to 75 minutes = 1.25 hours
      expect(service.applyRounding(1.3, rule)).toBeCloseTo(1.25, 2);
      // 1.4 hours = 84 minutes -> rounds to 90 minutes = 1.5 hours
      expect(service.applyRounding(1.4, rule)).toBeCloseTo(1.5, 2);
    });

    it('should apply minimum duration', () => {
      const rule = { roundToMinutes: 15, minimumDuration: 0.5 };
      expect(service.applyRounding(0.25, rule)).toBe(0.5);
    });

    it('should apply maximum duration', () => {
      const rule = { roundToMinutes: 15, maximumDuration: 8 };
      expect(service.applyRounding(10, rule)).toBe(8);
    });
  });

  describe('findDuplicates', () => {
    it('should find overlapping entries', () => {
      const entries: TimeEntry[] = [
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T11:00:00Z',
          duration: 2,
        },
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T12:00:00Z',
          duration: 2,
        },
      ];

      const duplicates = service.findDuplicates(entries);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].entry1.taskId).toBe('task1');
      expect(duplicates[0].entry2.taskId).toBe('task1');
    });

    it('should not find duplicates for different tasks', () => {
      const entries: TimeEntry[] = [
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T11:00:00Z',
          duration: 2,
        },
        {
          taskId: 'task2',
          taskName: 'Task 2',
          start: '2024-01-15T10:00:00Z',
          end: '2024-01-15T12:00:00Z',
          duration: 2,
        },
      ];

      const duplicates = service.findDuplicates(entries);

      expect(duplicates).toHaveLength(0);
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', () => {
      const entries: TimeEntry[] = [
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-15T09:00:00Z',
          end: '2024-01-15T10:00:00Z',
          duration: 1,
        },
        {
          taskId: 'task2',
          taskName: 'Task 2',
          start: '2024-01-15T11:00:00Z',
          end: '2024-01-15T12:00:00Z',
          duration: 1,
        },
        {
          taskId: 'task1',
          taskName: 'Task 1',
          start: '2024-01-16T09:00:00Z',
          end: '2024-01-16T10:00:00Z',
          duration: 1,
        },
      ];

      const stats = service.calculateStats(entries);

      expect(stats.totalEntries).toBe(3);
      expect(stats.totalDuration).toBe(3);
      expect(stats.uniqueTasks).toBe(2);
      expect(stats.entriesPerDay['2024-01-15']).toBe(2);
      expect(stats.entriesPerDay['2024-01-16']).toBe(1);
    });
  });
});
