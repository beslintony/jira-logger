import type {
  JiraClientConfig,
  JiraIssue,
  JiraProject,
  SearchResults,
  SearchOptions,
  LogWorkOptions,
  WorkLog,
  JiraApiError,
  ADFDocument,
} from './types.js';
import { createADFDocument } from './types.js';

/**
 * Jira API client with retry logic and error handling
 */
export class JiraClient {
  private config: Required<JiraClientConfig>;

  constructor(config: JiraClientConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Make an authenticated request to the Jira API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    
    const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
    
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    };

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url.toString(), {
          ...fetchOptions,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as JiraApiError;
          throw new JiraError(
            `Jira API error: ${response.status} ${response.statusText}`,
            response.status,
            errorData
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof JiraError && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(options: SearchOptions): Promise<SearchResults> {
    const params = new URLSearchParams();
    params.append('jql', options.jql);
    
    if (options.fields) {
      params.append('fields', options.fields.join(','));
    }
    if (options.startAt !== undefined) {
      params.append('startAt', options.startAt.toString());
    }
    if (options.maxResults !== undefined) {
      params.append('maxResults', options.maxResults.toString());
    }

    return this.request<SearchResults>(`/rest/api/3/search?${params.toString()}`);
  }

  /**
   * Get a single issue by key
   */
  async getIssue(key: string, fields?: string[]): Promise<JiraIssue> {
    const params = new URLSearchParams();
    if (fields) {
      params.append('fields', fields.join(','));
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<JiraIssue>(`/rest/api/3/issue/${key}${query}`);
  }

  /**
   * Check if an issue exists and is accessible
   */
  async issueExists(key: string): Promise<boolean> {
    try {
      await this.getIssue(key, ['id']);
      return true;
    } catch (error) {
      if (error instanceof JiraError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all accessible projects
   */
  async listProjects(): Promise<JiraProject[]> {
    return this.request<JiraProject[]>('/rest/api/3/project');
  }

  /**
   * Log work time to an issue
   */
  async logWork(options: LogWorkOptions): Promise<WorkLog> {
    const { issueKey, timeSpent, started, comment } = options;

    // Convert timeSpent to seconds if it's a string
    const timeSpentSeconds = typeof timeSpent === 'string'
      ? parseTimeSpent(timeSpent)
      : timeSpent;

    // Create ADF comment if provided
    const commentDoc: ADFDocument | undefined = comment
      ? createADFDocument(comment)
      : undefined;

    const body: Record<string, unknown> = {
      timeSpentSeconds,
      started,
    };

    if (commentDoc) {
      body.comment = commentDoc;
    }

    return this.request<WorkLog>(`/rest/api/3/issue/${issueKey}/worklog`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get work logs for an issue
   */
  async getWorkLogs(issueKey: string): Promise<{ worklogs: WorkLog[] }> {
    return this.request<{ worklogs: WorkLog[] }>(`/rest/api/3/issue/${issueKey}/worklog`);
  }

  /**
   * Delete a work log
   */
  async deleteWorkLog(issueKey: string, workLogId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${issueKey}/worklog/${workLogId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test the connection to Jira
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const projects = await this.listProjects();
      return {
        success: true,
        message: `Connected successfully. Found ${projects.length} projects.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Custom error class for Jira API errors
 */
export class JiraError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: JiraApiError
  ) {
    super(message);
    this.name = 'JiraError';
  }
}

/**
 * Parse time spent string to seconds
 * Supports formats: "2h", "30m", "2h 30m", "2.5h"
 */
function parseTimeSpent(timeSpent: string): number {
  let seconds = 0;
  
  // Hours
  const hoursMatch = /(\d+(?:\.\d+)?)\s*h/i.exec(timeSpent);
  if (hoursMatch?.[1]) {
    seconds += parseFloat(hoursMatch[1]) * 3600;
  }
  
  // Minutes
  const minutesMatch = /(\d+)\s*m/i.exec(timeSpent);
  if (minutesMatch?.[1]) {
    seconds += parseInt(minutesMatch[1]) * 60;
  }
  
  // If no matches, try parsing as decimal hours
  if (seconds === 0) {
    const decimal = parseFloat(timeSpent);
    if (!isNaN(decimal)) {
      seconds = decimal * 3600;
    }
  }
  
  return Math.round(seconds);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a new Jira client
 */
export function createJiraClient(config: JiraClientConfig): JiraClient {
  return new JiraClient(config);
}
