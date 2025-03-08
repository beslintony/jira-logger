import * as fs from 'fs';
import * as path from 'path';
import { TimeEntry } from './parser';
import { loadSettings } from './setttings';
import { verifyTicket } from './jira';

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

interface MappingsFile {
    loggedEntries: LoggedEntry[];
    taskToTicketMappings: Record<string, string>; // taskName -> ticketId
    lastSync: string; // Timestamp of last sync with Jira
}

/**
 * Load logged entries and mappings from the mappings file.
 */
export const loadMappingsFile = (): MappingsFile => {
    const settings = loadSettings();
    const mappingsPath = settings.fileStorage.mappingsPath;
    
    if (!fs.existsSync(mappingsPath)) {
        return {
            loggedEntries: [],
            taskToTicketMappings: {},
            lastSync: new Date().toISOString()
        };
    }
    
    try {
        const data = fs.readFileSync(mappingsPath, 'utf-8');
        const parsed = JSON.parse(data);
        
        return {
            loggedEntries: parsed.loggedEntries || [],
            taskToTicketMappings: parsed.taskToTicketMappings || {},
            lastSync: parsed.lastSync || new Date().toISOString()
        };
    } catch (error) {
        console.warn(`⚠️ Error loading mappings file: ${error}. Using empty mappings.`);
        return {
            loggedEntries: [],
            taskToTicketMappings: {},
            lastSync: new Date().toISOString()
        };
    }
};

/**
 * Save logged entries and mappings to the mappings file.
 */
export const saveMappingsFile = (data: MappingsFile) => {
    const settings = loadSettings();
    const mappingsPath = settings.fileStorage.mappingsPath;
    
    // Make sure directory exists
    const dir = path.dirname(mappingsPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(mappingsPath, JSON.stringify(data, null, 2));
};

/**
 * Load logged entries from the mappings file.
 */
export const loadLoggedEntries = (): LoggedEntry[] => {
    return loadMappingsFile().loggedEntries;
};

/**
 * Load task-to-ticket mappings from the mappings file.
 */
export const loadTaskToTicketMappings = (): Record<string, string> => {
    return loadMappingsFile().taskToTicketMappings;
};

/**
 * Save a new task-to-ticket mapping.
 */
export const saveTaskToTicketMapping = (taskName: string, ticketId: string) => {
    const mappingsFile = loadMappingsFile();
    mappingsFile.taskToTicketMappings[taskName] = ticketId;
    mappingsFile.lastSync = new Date().toISOString();
    saveMappingsFile(mappingsFile);
};

/**
 * Save logged entries to the mappings file.
 */
export const saveLoggedEntries = (loggedEntries: LoggedEntry[]) => {
    const mappingsFile = loadMappingsFile();
    mappingsFile.loggedEntries = loggedEntries;
    saveMappingsFile(mappingsFile);
};

/**
 * Check if a time entry has already been logged.
 * Now checks by task ID AND date to allow for multiple entries on different days.
 */
export const isEntryLogged = (taskId: string, date: string, loggedEntries: LoggedEntry[]): boolean => {
    return loggedEntries.some((entry) => {
        const entryDate = new Date(entry.loggedAt).toISOString().split('T')[0];
        return entry.taskId === taskId && entryDate === date;
    });
};

/**
 * Apply time rounding based on settings.
 * @param timeSpent - The time spent in hours.
 */
export const applyTimeRounding = (timeSpent: number): number => {
    const settings = loadSettings();
    if (settings.timeRounding.enabled) {
        const roundTo = settings.timeRounding.roundTo;
        const totalMinutes = timeSpent * 60;
        const roundedMinutes = Math.round(totalMinutes / roundTo) * roundTo;
        return roundedMinutes / 60;
    }
    return timeSpent;
};

/**
 * Format time spent in hours and minutes (e.g., "2h 30m").
 * @param timeSpent - The time spent in hours (e.g., 2.5).
 */
export const formatTimeSpent = (timeSpent: number): string => {
    const hours = Math.floor(timeSpent);
    const minutes = Math.round((timeSpent - hours) * 60);

    if (hours === 0) {
        return `${minutes}m`; // e.g., "30m"
    } else if (minutes === 0) {
        return `${hours}h`; // e.g., "2h"
    } else {
        return `${hours}h ${minutes}m`; // e.g., "2h 30m"
    }
};

/**
 * Generate a meaningful work log comment based on the task name and time spent.
 * @param taskName - Name of the task.
 * @param timeSpent - Formatted time spent.
 * @returns A comment string for the work log.
 */
export const generateWorkLogComment = (taskName: string, timeSpent: string): string => {
    // Remove ticket ID if present in task name
    const cleanTaskName = taskName.replace(/[A-Z]+-\d+\s*/, '').trim();
    return `Worked on "${cleanTaskName}" for ${timeSpent}`;
};

/**
 * Group time entries by day and task, and calculate total time spent per task per day.
 * @param timeEntries - Array of time entries.
 */
export const groupByDayAndTask = (timeEntries: TimeEntry[]): { 
    [date: string]: { 
        [taskId: string]: { 
            duration: number, 
            taskName: string 
        } 
    } 
} => {
    const grouped: { 
        [date: string]: { 
            [taskId: string]: { 
                duration: number, 
                taskName: string 
            } 
        } 
    } = {};

    timeEntries.forEach((entry) => {
        const date = new Date(entry.start).toISOString().split('T')[0]; // Extract date (YYYY-MM-DD)
        
        if (!grouped[date]) {
            grouped[date] = {};
        }
        
        if (!grouped[date][entry.taskId]) {
            grouped[date][entry.taskId] = {
                duration: 0,
                taskName: entry.taskName
            };
        }
        
        grouped[date][entry.taskId].duration += entry.duration;
    });

    return grouped;
};

/**
 * Check for tickets that need to be logged soon (from last X days)
 * @param days Number of past days to check
 */
export const findRecentUnloggedWork = (timeEntries: TimeEntry[], loggedEntries: LoggedEntry[], days: number = 7): TimeEntry[] => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    
    return timeEntries.filter(entry => {
        const entryDate = new Date(entry.start);
        if (entryDate < cutoff) return false;
        
        // Check if this entry has been logged
        const entryDateStr = entryDate.toISOString().split('T')[0];
        return !isEntryLogged(entry.taskId, entryDateStr, loggedEntries);
    });
};