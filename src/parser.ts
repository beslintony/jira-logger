import * as fs from 'fs';

export interface TimeEntry {
    taskId: string;
    taskName: string;
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
    duration: number; // Duration in hours
}

/**
 * Parse the time log file and extract time entries.
 * @param filePath - Path to the time log file.
 */
export const parseFile = (filePath: string): TimeEntry[] => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return data.f.r.map((entry: any) => {
        const start = new Date(entry.s);
        const end = new Date(entry.e);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Convert milliseconds to hours

        return {
            taskId: entry.t,
            taskName: data.f.t.find((task: any) => task.i === entry.t)?.n || 'Unknown',
            start: start.toISOString(),
            end: end.toISOString(),
            duration,
        };
    });
};