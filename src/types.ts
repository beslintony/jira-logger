// Common interfaces used across the application

export interface TimeEntry {
    taskId: string;
    taskName: string;
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
    duration: number; // Duration in hours
}

export interface JiraError {
    response?: {
        data?: any;
    };
    message?: string;
}

export interface LoggedEntry {
    taskId: string;
    taskName: string; // Added taskName for better identification
    ticketId: string;
    timeSpent: string;
    loggedAt: string;
    comment?: string; // Added comment field
}

export interface TaskToTicketMapping {
    taskName: string;
    ticketId: string;
    lastUsed: string; // Timestamp when mapping was last used
}

export interface MappingsFile {
    loggedEntries: LoggedEntry[];
    taskToTicketMappings: Record<string, string>; // taskName -> ticketId
    lastSync: string; // Timestamp of last sync with Jira
}

export interface JiraTicket {
    key: string;
    fields: {
        summary: string;
        status?: {
            name: string;
        };
    };
}

export interface Settings {
    jira: {
        baseUrl: string;
        username: string;
        apiToken: string;
        defaultProject: string;
    };
    timeRounding: {
        enabled: boolean;
        roundTo: number; // Minutes (e.g., 15 for rounding to the nearest 15 minutes)
    };
    fileStorage: {
        gsjbdPath: string;
        mappingsPath: string;
    };
    comments?: {
        defaultTemplate: string; // Template for work log comments with placeholders
    };
    appearance?: {
        dateFormat: string; // Format for displaying dates
    };
    sync?: {
        autoSyncMappings: boolean; // Auto-sync mappings with Jira on startup
        reminderDays: number; // Remind about unlogged time entries for N days
    };
}