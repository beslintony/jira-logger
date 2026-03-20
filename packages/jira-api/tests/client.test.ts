import { describe, it, expect, beforeEach } from 'vitest';
import { JiraClient, JiraError, createJiraClient } from '../src/index.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('JiraClient', () => {
  const config = {
    baseUrl: 'https://test.atlassian.net',
    username: 'test@example.com',
    apiToken: 'test-token',
    maxRetries: 1,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new JiraClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('searchIssues', () => {
    it('should search issues with JQL', async () => {
      const mockResponse = {
        total: 1,
        startAt: 0,
        maxResults: 50,
        issues: [
          {
            key: 'TEST-123',
            id: '10001',
            fields: { summary: 'Test Issue' },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const client = createJiraClient(config);
      const results = await client.searchIssues({ jql: 'project = TEST' });

      expect(results.issues).toHaveLength(1);
      expect(results.issues[0].key).toBe('TEST-123');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/search?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic '),
          }),
        })
      );
    });

    it('should throw JiraError on API error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ errorMessages: ['Invalid JQL'] }),
      } as Response);

      const client = createJiraClient(config);
      await expect(client.searchIssues({ jql: 'invalid' })).rejects.toThrow(JiraError);
    });
  });

  describe('getIssue', () => {
    it('should fetch issue by key', async () => {
      const mockIssue = {
        key: 'TEST-123',
        id: '10001',
        fields: { summary: 'Test Issue', status: { name: 'Open' } },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
      } as Response);

      const client = createJiraClient(config);
      const issue = await client.getIssue('TEST-123');

      expect(issue.key).toBe('TEST-123');
      expect(issue.fields.summary).toBe('Test Issue');
    });
  });

  describe('issueExists', () => {
    it('should return true for existing issue', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-123', id: '10001', fields: {} }),
      } as Response);

      const client = createJiraClient(config);
      const exists = await client.issueExists('TEST-123');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent issue', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ errorMessages: ['Issue does not exist'] }),
      } as Response);

      const client = createJiraClient(config);
      const exists = await client.issueExists('TEST-999');

      expect(exists).toBe(false);
    });
  });

  describe('logWork', () => {
    it('should log work with time string', async () => {
      const mockWorkLog = { id: '10000', timeSpentSeconds: 3600 };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkLog,
      } as Response);

      const client = createJiraClient(config);
      const result = await client.logWork({
        issueKey: 'TEST-123',
        timeSpent: '1h',
        started: '2024-01-15T09:00:00.000+0000',
        comment: 'Test work log',
      });

      expect(result.timeSpentSeconds).toBe(3600);
    });

    it('should log work with seconds', async () => {
      const mockWorkLog = { id: '10000', timeSpentSeconds: 1800 };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkLog,
      } as Response);

      const client = createJiraClient(config);
      const result = await client.logWork({
        issueKey: 'TEST-123',
        timeSpent: 1800,
        started: '2024-01-15T09:00:00.000+0000',
      });

      expect(result.timeSpentSeconds).toBe(1800);
    });
  });

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ key: 'PROJ', name: 'Project' }],
      } as Response);

      const client = createJiraClient(config);
      const result = await client.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected successfully');
    });

    it('should return failure on error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const client = createJiraClient(config);
      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
    });
  });
});
