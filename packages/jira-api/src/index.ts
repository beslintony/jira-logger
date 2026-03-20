// Export types
export type {
  JiraClientConfig,
  JiraIssue,
  JiraProject,
  WorkLog,
  SearchResults,
  SearchOptions,
  LogWorkOptions,
  JiraApiError,
  ADFDocument,
  ADFNode,
  ADFParagraph,
  ADFTextNode,
} from './types.js';

// Export functions and classes
export {
  JiraClient,
  JiraError,
  createJiraClient,
} from './client.js';

export { createADFDocument } from './types.js';
