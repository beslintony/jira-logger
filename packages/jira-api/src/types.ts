/**
 * Jira issue/ticket representation
 */
export interface JiraIssue {
  /** Issue key (e.g., PROJ-123) */
  key: string;
  
  /** Issue ID */
  id: string;
  
  /** Issue fields */
  fields: {
    /** Issue summary/title */
    summary: string;
    
    /** Issue status */
    status?: {
      name: string;
      id: string;
    };
    
    /** Issue type */
    issuetype?: {
      name: string;
    };
    
    /** Assignee */
    assignee?: {
      displayName: string;
      emailAddress?: string;
    } | null;
    
    /** Reporter */
    reporter?: {
      displayName: string;
    };
    
    /** Priority */
    priority?: {
      name: string;
    };
    
    /** Created date */
    created?: string;
    
    /** Updated date */
    updated?: string;
  };
}

/**
 * Jira project representation
 */
export interface JiraProject {
  /** Project key */
  key: string;
  
  /** Project ID */
  id: string;
  
  /** Project name */
  name: string;
}

/**
 * Work log entry
 */
export interface WorkLog {
  /** Work log ID */
  id?: string;
  
  /** Time spent in Jira format (e.g., "2h 30m") */
  timeSpent?: string;
  
  /** Time spent in seconds */
  timeSpentSeconds?: number;
  
  /** When the work was started */
  started?: string;
  
  /** Comment/description */
  comment?: string;
  
  /** Author */
  author?: {
    displayName: string;
  };
}

/**
 * Search results from JQL query
 */
export interface SearchResults {
  /** Total number of issues matching query (may not be present in v3/search/jql) */
  total?: number;
  
  /** Issues in current page */
  issues: JiraIssue[];
  
  /** Start at index */
  startAt?: number;
  
  /** Max results per page */
  maxResults?: number;
  
  /** Whether this is the last page of results */
  isLast?: boolean;
  
  /** Next page token (for pagination in v3/search/jql) */
  nextPageToken?: string;
}

/**
 * Jira API error
 */
export interface JiraApiError {
  /** Error messages */
  errorMessages?: string[];
  
  /** Field-specific errors */
  errors?: Record<string, string>;
}

/**
 * Jira client configuration
 */
export interface JiraClientConfig {
  /** Jira base URL (e.g., https://company.atlassian.net) */
  baseUrl: string;
  
  /** Username (email) */
  username: string;
  
  /** API token */
  apiToken: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Search issues options
 */
export interface SearchOptions {
  /** JQL query */
  jql: string;
  
  /** Fields to return */
  fields?: string[];
  
  /** Start at index */
  startAt?: number;
  
  /** Max results per page */
  maxResults?: number;
}

/**
 * Log work options
 */
export interface LogWorkOptions {
  /** Issue key */
  issueKey: string;
  
  /** Time spent in Jira format (e.g., "2h 30m") or seconds */
  timeSpent: string | number;
  
  /** When the work was started (ISO 8601) */
  started: string;
  
  /** Comment for the work log */
  comment?: string;
}

/**
 * Atlassian Document Format (ADF) for comments
 */
export interface ADFDocument {
  version: 1;
  type: 'doc';
  content: ADFNode[];
}

export type ADFNode = ADFParagraph;

export interface ADFParagraph {
  type: 'paragraph';
  content: ADFTextNode[];
}

export interface ADFTextNode {
  type: 'text';
  text: string;
}

/**
 * Create ADF document from plain text
 */
export function createADFDocument(text: string): ADFDocument {
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
          },
        ],
      },
    ],
  };
}
