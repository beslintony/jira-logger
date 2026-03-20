import { describe, it, expect } from 'vitest';
import { createGrindstoneParser } from '../src/index.js';

describe('GrindstoneParser', () => {
  const parser = createGrindstoneParser();

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(parser.metadata.name).toBe('grindstone');
      expect(parser.metadata.displayName).toBe('Grindstone');
      expect(parser.metadata.supportedExtensions).toContain('.gsjbd');
      expect(parser.metadata.supportsFile).toBe(true);
      expect(parser.metadata.supportsApi).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse valid Grindstone JSON', async () => {
      const sampleData = {
        f: {
          t: [
            { i: 'task1', n: 'Test Task 1' },
            { i: 'task2', n: 'Test Task 2' },
          ],
          r: [
            { t: 'task1', s: '2024-01-15T09:00:00Z', e: '2024-01-15T10:30:00Z' },
            { t: 'task2', s: '2024-01-15T11:00:00Z', e: '2024-01-15T12:00:00Z' },
          ],
        },
      };

      const entries = await parser.parse(JSON.stringify(sampleData));

      expect(entries).toHaveLength(2);
      expect(entries[0].taskName).toBe('Test Task 1');
      expect(entries[0].duration).toBe(1.5); // 1.5 hours
      expect(entries[1].taskName).toBe('Test Task 2');
      expect(entries[1].duration).toBe(1); // 1 hour
    });

    it('should handle unknown task IDs', async () => {
      const sampleData = {
        f: {
          t: [{ i: 'task1', n: 'Known Task' }],
          r: [
            { t: 'task1', s: '2024-01-15T09:00:00Z', e: '2024-01-15T10:00:00Z' },
            { t: 'unknown', s: '2024-01-15T11:00:00Z', e: '2024-01-15T12:00:00Z' },
          ],
        },
      };

      const entries = await parser.parse(JSON.stringify(sampleData));

      expect(entries).toHaveLength(2);
      expect(entries[0].taskName).toBe('Known Task');
      expect(entries[1].taskName).toBe('Unknown Task');
    });
  });

  describe('validate', () => {
    it('should validate correct structure', async () => {
      const sampleData = {
        f: {
          t: [],
          r: [],
        },
      };

      const result = await parser.validate(JSON.stringify(sampleData));

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON', async () => {
      const result = await parser.validate('not valid json');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing f property', async () => {
      const result = await parser.validate(JSON.stringify({}));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing 'f' property in root");
    });

    it('should reject missing tasks array', async () => {
      const sampleData = { f: { r: [] } };
      const result = await parser.validate(JSON.stringify(sampleData));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing or invalid 'f.t' (tasks array)");
    });
  });
});
