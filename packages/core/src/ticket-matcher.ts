import type { JiraClient, JiraIssue } from '@jira-logger/jira-api';
import type { MatchResult, TaskMapping } from './types.js';

/**
 * Service for matching tasks to Jira tickets
 */
export class TicketMatcher {
  private jiraClient: JiraClient;
  private mappings: Map<string, TaskMapping> = new Map();

  constructor(jiraClient: JiraClient, mappings: TaskMapping[] = []) {
    this.jiraClient = jiraClient;
    this.loadMappings(mappings);
  }

  /**
   * Load task-to-issue mappings
   */
  loadMappings(mappings: TaskMapping[]): void {
    this.mappings.clear();
    for (const mapping of mappings) {
      this.mappings.set(mapping.taskName, mapping);
    }
  }

  /**
   * Get all loaded mappings
   */
  getMappings(): TaskMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Match a task name to Jira issues
   * Returns sorted array of matches by confidence
   */
  async match(taskName: string): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    // 1. Check saved mappings first
    const savedMapping = this.mappings.get(taskName);
    if (savedMapping) {
      try {
        const issue = await this.jiraClient.getIssue(savedMapping.issueKey);
        matches.push({
          issue,
          confidence: 1.0,
          reason: 'Saved mapping',
        });
        return matches;
      } catch {
        // Mapping is stale, continue with other methods
        this.mappings.delete(taskName);
      }
    }

    // 2. Extract ticket ID from task name (e.g., "PROJ-123 Task name")
    const extractedKey = this.extractTicketKey(taskName);
    if (extractedKey) {
      try {
        const issue = await this.jiraClient.getIssue(extractedKey);
        matches.push({
          issue,
          confidence: 0.95,
          reason: 'Ticket ID in task name',
        });
        return matches;
      } catch {
        // Extracted key doesn't exist, continue
      }
    }

    // 3. Search by text similarity
    const searchResults = await this.jiraClient.searchIssues({
      jql: `text ~ "${this.escapeJql(taskName)}" OR summary ~ "${this.escapeJql(taskName)}"`,
      maxResults: 10,
      fields: ['summary', 'status', 'assignee'],
    });

    for (const issue of searchResults.issues) {
      const confidence = this.calculateSimilarity(taskName, issue.fields.summary);
      if (confidence > 0.3) {
        matches.push({
          issue,
          confidence,
          reason: 'Text similarity',
        });
      }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  /**
   * Match multiple tasks at once
   */
  async matchMultiple(taskNames: string[]): Promise<Map<string, MatchResult[]>> {
    const results = new Map<string, MatchResult[]>();

    for (const taskName of taskNames) {
      const matches = await this.match(taskName);
      results.set(taskName, matches);
    }

    return results;
  }

  /**
   * Save a mapping from task name to issue key
   */
  saveMapping(taskName: string, issueKey: string): TaskMapping {
    const existing = this.mappings.get(taskName);
    
    const mapping: TaskMapping = {
      taskName,
      issueKey,
      lastUsed: new Date().toISOString(),
      useCount: existing ? existing.useCount + 1 : 1,
    };

    this.mappings.set(taskName, mapping);
    return mapping;
  }

  /**
   * Remove a mapping
   */
  removeMapping(taskName: string): boolean {
    return this.mappings.delete(taskName);
  }

  /**
   * Validate all saved mappings against Jira
   * Returns valid mappings and removes invalid ones
   */
  async validateMappings(): Promise<{
    valid: TaskMapping[];
    invalid: TaskMapping[];
  }> {
    const valid: TaskMapping[] = [];
    const invalid: TaskMapping[] = [];

    for (const [taskName, mapping] of this.mappings) {
      try {
        await this.jiraClient.getIssue(mapping.issueKey);
        valid.push(mapping);
      } catch {
        invalid.push(mapping);
        this.mappings.delete(taskName);
      }
    }

    return { valid, invalid };
  }

  /**
   * Extract Jira ticket key from text (e.g., "PROJ-123")
   */
  private extractTicketKey(text: string): string | null {
    // Match pattern: PROJECT-123 (uppercase letters/numbers, hyphen, numbers)
    const match = text.match(/\b([A-Z][A-Z0-9_]*-\d+)\b/);
    return match?.[1] ?? null;
  }

  /**
   * Calculate text similarity between task name and issue summary
   * Returns value between 0 and 1
   */
  private calculateSimilarity(taskName: string, summary: string): number {
    const taskWords = this.tokenize(taskName);
    const summaryWords = this.tokenize(summary);

    if (taskWords.length === 0 || summaryWords.length === 0) {
      return 0;
    }

    let matches = 0;
    for (const word of taskWords) {
      if (summaryWords.some(sw => sw.includes(word) || word.includes(sw))) {
        matches++;
      }
    }

    // Calculate Jaccard similarity
    const union = new Set([...taskWords, ...summaryWords]).size;
    return union > 0 ? matches / union : 0;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Escape special characters in JQL
   */
  private escapeJql(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }
}

/**
 * Create a new ticket matcher
 */
export function createTicketMatcher(
  jiraClient: JiraClient,
  mappings: TaskMapping[] = []
): TicketMatcher {
  return new TicketMatcher(jiraClient, mappings);
}
