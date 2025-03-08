import axios from 'axios';
import { loadSettings } from './setttings';
import { JiraError, JiraTicket } from './types';

/**
 * Create a configured axios instance for Jira API
 */
const createJiraClient = () => {
    const settings = loadSettings();
    
    return axios.create({
        baseURL: settings.jira.baseUrl,
        auth: {
            username: settings.jira.username,
            password: settings.jira.apiToken,
        },
        headers: {
            'Content-Type': 'application/json',
        },
    });
};

// Fetch Jira ticket details to verify it exists and is valid for logging
export const verifyTicket = async (ticketId: string): Promise<JiraTicket | null> => {
    const jira = createJiraClient();
    
    try {
        const response = await jira.get(`/rest/api/3/issue/${ticketId}`);
        return response.data;
    } catch (error) {
        const jiraError = error as JiraError;
        console.error(
            `⚠️ Unable to verify ticket ${ticketId}:`,
            jiraError.response?.data || jiraError.message
        );
        return null;
    }
};

export const logTime = async (ticketId: string, timeSpent: string, started: string, comment: string = '') => {
    const jira = createJiraClient();
    
    try {
        // First verify the ticket exists and is in valid state
        const ticket = await verifyTicket(ticketId);
        if (!ticket) {
            console.error(`❌ Could not log time: Ticket ${ticketId} not found or inaccessible`);
            return null;
        }
        
        // Check if ticket is in a closed status (optional)
        if (ticket.fields?.status?.name === 'Closed' || ticket.fields?.status?.name === 'Done') {
            console.warn(`⚠️ Warning: Ticket ${ticketId} is in ${ticket.fields.status.name} status`);
            // Proceed anyway but with warning
        }

        // Convert timeSpent string (e.g., "1h 30m") to seconds
        const timeSpentSeconds = convertTimeSpentToSeconds(timeSpent);
        
        // Convert plain text comment to Atlassian Document Format (ADF)
        const commentADF = {
            content: [
                {
                    content: [
                        {
                            text: comment,
                            type: "text"
                        }
                    ],
                    type: "paragraph"
                }
            ],
            type: "doc",
            version: 1
        };

        // The payload format for Jira REST API v3
        const payload = {
            comment: commentADF,
            started: started,
            timeSpentSeconds: timeSpentSeconds
        };

        console.log("Sending payload:", payload);
        
        const response = await jira.post(`/rest/api/3/issue/${ticketId}/worklog`, payload);
        console.log(`✅ Logged ${timeSpent} to ${ticketId}`);
        return response.data;
    } catch (error) {
        const jiraError = error as JiraError;
        console.error(
            `❌ Failed to log time to ${ticketId}:`,
            jiraError.response?.data || jiraError.message
        );
        throw error;
    }
};

/**
 * Convert timeSpent string (e.g., "1h 30m") to seconds
 * @param timeSpent String representing time in "Xh Ym" format
 * @returns Number of seconds
 */
function convertTimeSpentToSeconds(timeSpent: string): number {
    let seconds = 0;
    
    // Extract hours
    const hoursMatch = timeSpent.match(/(\d+)h/);
    if (hoursMatch) {
        seconds += parseInt(hoursMatch[1]) * 3600; // Convert hours to seconds
    }
    
    // Extract minutes
    const minutesMatch = timeSpent.match(/(\d+)m/);
    if (minutesMatch) {
        seconds += parseInt(minutesMatch[1]) * 60; // Convert minutes to seconds
    }
    
    return seconds;
}

/**
 * Fetch all projects.
 */
export const fetchProjects = async () => {
    const jira = createJiraClient();
    
    try {
        const response = await jira.get('/rest/api/3/project');
        return response.data;
    } catch (error) {
        const jiraError = error as JiraError;
        console.error(
            '❌ Failed to fetch projects:',
            jiraError.response?.data || jiraError.message
        );
        throw error;
    }
};

/**
 * Extract the ticket ID from the task name (e.g., "TST-1 Grindstone installation" -> "TST-1").
 * @param taskName - The task name from the .gsjbd file.
 */
const extractTicketId = (taskName: string): string | null => {
    // Enhanced regex pattern to match most common Jira ticket formats
    // Examples: ABC-123, PROJ-1, TEST-42
    const match = taskName.match(/[A-Z][A-Z0-9_]+-\d+/);
    return match ? match[0] : null;
};

// Cache for mapped tickets to avoid repeated API calls
const ticketCache: Map<string, JiraTicket[]> = new Map();

/**
 * Fetch all tickets in the default project.
 */
export const fetchTickets = async () => {
    const jira = createJiraClient();
    const settings = loadSettings();
    
    try {
        // Enhanced JQL query to get active tickets
        // - Ordered by recently updated first
        // - Include only non-closed tickets by default
        const response = await jira.get('/rest/api/3/search', {
            params: {
                jql: `project = ${settings.jira.defaultProject} ORDER BY updated DESC`,
                maxResults: 100
            },
        });
        return response.data.issues;
    } catch (error) {
        const jiraError = error as JiraError;
        console.error(
            '❌ Failed to fetch tickets:',
            jiraError.response?.data || jiraError.message
        );
        throw error;
    }
};

/**
 * Enhanced matching algorithm that considers:
 * 1. Exact ticket ID matches first
 * 2. Title similarity using fuzzy matching
 * 3. Content/description similarity
 * 4. Previously mapped tasks (from mappings.json)
 * 
 * @param taskName - The task name from the .gsjbd file.
 * @param mappedTickets - Previously mapped tickets from mappings.json
 */
export const matchTickets = async (taskName: string, mappedTickets: Record<string, string> = {}) => {
    // First check if we already have a saved mapping for this exact task name
    if (mappedTickets[taskName]) {
        const savedTicketId = mappedTickets[taskName];
        const ticket = await verifyTicket(savedTicketId);
        
        if (ticket) {
            console.log(`📋 Using saved mapping: "${taskName}" -> ${savedTicketId}`);
            return [ticket];
        } else {
            console.warn(`⚠️ Saved ticket mapping ${savedTicketId} is no longer valid. Searching for alternatives...`);
            // Fall through to normal search if cached mapping is no longer valid
        }
    }
    
    // Check the cache first
    if (ticketCache.has(taskName)) {
        return ticketCache.get(taskName) || [];
    }
    
    const ticketId = extractTicketId(taskName);
    let matchedTickets: JiraTicket[] = [];
    
    try {
        // If we have an explicit ticket ID in the task name, prioritize that
        if (ticketId) {
            const ticket = await verifyTicket(ticketId);
            if (ticket) {
                matchedTickets = [ticket];
                ticketCache.set(taskName, matchedTickets);
                return matchedTickets;
            }
        }
        
        // Otherwise search for tickets in the default project
        const allTickets = await fetchTickets();
        
        // Perform matching based on text similarity
        matchedTickets = allTickets.filter((ticket: JiraTicket) => {
            // Direct match (case insensitive)
            if (ticket.fields.summary.toLowerCase() === taskName.toLowerCase()) {
                return true;
            }
            
            // Contains match (case insensitive)
            if (ticket.fields.summary.toLowerCase().includes(taskName.toLowerCase()) || 
                taskName.toLowerCase().includes(ticket.fields.summary.toLowerCase())) {
                return true;
            }
            
            // Word by word match (at least 50% of words match)
            const taskWords = taskName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const summaryWords = ticket.fields.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            
            let matchCount = 0;
            for (const word of taskWords) {
                if (summaryWords.some(sw => sw.includes(word) || word.includes(sw))) {
                    matchCount++;
                }
            }
            
            return taskWords.length > 0 && matchCount / taskWords.length >= 0.5;
        });
        
        // Sort matches by relevance
        matchedTickets.sort((a, b) => {
            // Exact matches first
            const aExact = a.fields.summary.toLowerCase() === taskName.toLowerCase();
            const bExact = b.fields.summary.toLowerCase() === taskName.toLowerCase();
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            // Then by how closely the length matches
            const aLenDiff = Math.abs(a.fields.summary.length - taskName.length);
            const bLenDiff = Math.abs(b.fields.summary.length - taskName.length);
            
            return aLenDiff - bLenDiff;
        });
        
        // Cache the results
        ticketCache.set(taskName, matchedTickets);
        return matchedTickets;
    } catch (error) {
        console.error('Error matching tickets:', error);
        return [];
    }
};

/**
 * Sync local task-ticket mappings with Jira
 * Validates all saved mappings to ensure they're still valid
 */
export const syncMappings = async (mappings: Record<string, string>): Promise<Record<string, string>> => {
    const validatedMappings: Record<string, string> = {};
    
    for (const [taskName, ticketId] of Object.entries(mappings)) {
        // Verify each ticket still exists and is valid
        const ticket = await verifyTicket(ticketId);
        if (ticket) {
            validatedMappings[taskName] = ticketId;
        } else {
            console.warn(`⚠️ Mapping for "${taskName}" -> ${ticketId} is no longer valid and will be removed`);
        }
    }
    
    return validatedMappings;
};