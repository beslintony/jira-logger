import inquirer from 'inquirer';
import chalk from 'chalk';
import { logTime, matchTickets, syncMappings, fetchProjects } from './jira';
import { parseFile } from './parser';
import { loadSettings, saveSettings } from './setttings';
import { 
    applyTimeRounding, 
    formatTimeSpent, 
    groupByDayAndTask, 
    loadLoggedEntries, 
    loadTaskToTicketMappings, 
    saveLoggedEntries, 
    saveTaskToTicketMapping,
    generateWorkLogComment,
    isEntryLogged,
    findRecentUnloggedWork
} from './utils';
import { LoggedEntry } from './types';

/**
 * Helper function to log time to Jira and save the entry
 */
const logTimeToJira = async (
    ticketId: string,
    taskId: string,
    taskName: string,
    formattedTimeSpent: string,
    date: string,
    comment: string,
    loggedEntries: LoggedEntry[]
) => {
    try {
        // Set the start time to mid-time of the day (12:00 PM)
        const started = new Date(date);
        started.setHours(12, 0, 0, 0); // 12:00 PM
        
        // Format as "yyyy-MM-ddTHH:mm:ss.000+0000" - Jira requires this specific format
        const startedISO = started.toISOString().slice(0, -1) + '+0000';
        
        console.log({
            ticketId,
            formattedTimeSpent,
            startedISO,
            comment
        });

        // Log time to Jira
        const result = await logTime(ticketId, formattedTimeSpent, startedISO, comment);
        
        if (!result) {
            console.log(chalk.red(`❌ Failed to log time to ${ticketId} on ${date}`));
            return;
        }

        // Save the logged entry
        const loggedEntry: LoggedEntry = {
            taskId,
            taskName,
            ticketId,
            timeSpent: formattedTimeSpent,
            loggedAt: startedISO,
            comment
        };
        
        loggedEntries.push(loggedEntry);
        saveLoggedEntries(loggedEntries);

        console.log(chalk.green(`✅ Logged ${formattedTimeSpent} to ${ticketId} on ${date}`));
    } catch (error) {
        const jiraError = error as { message?: string; response?: { data?: any } };
        console.error(
            chalk.red(`❌ Failed to log time to ${ticketId} on ${date}:`),
            jiraError.response?.data || jiraError.message || String(error)
        );
    }
};

/**
 * Show recent logged entries
 */
const viewLoggedEntries = async (loggedEntries: LoggedEntry[]): Promise<void> => {
    if (loggedEntries.length === 0) {
        console.log(chalk.yellow('📄 No logged entries found.'));
        return;
    }
    
    // Sort by date (most recent first)
    const sortedEntries = [...loggedEntries].sort((a, b) => 
        new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );
    
    console.log(chalk.bold.blue(`\n📋 Recent logged entries (${sortedEntries.length} total):`));
    
    // Group by date for better readability
    const entriesByDate: Record<string, LoggedEntry[]> = {};
    
    sortedEntries.forEach(entry => {
        const date = new Date(entry.loggedAt).toISOString().split('T')[0];
        if (!entriesByDate[date]) {
            entriesByDate[date] = [];
        }
        entriesByDate[date].push(entry);
    });
    
    // Display entries grouped by date
    for (const [date, entries] of Object.entries(entriesByDate)) {
        console.log(chalk.bold(`\n📅 ${date}:`));
        
        let totalTime = 0;
        entries.forEach(entry => {
            // Extract hours and minutes from timeSpent string, e.g., "2h 30m" -> 2.5 hours
            const hoursMatch = entry.timeSpent.match(/(\d+)h/);
            const minutesMatch = entry.timeSpent.match(/(\d+)m/);
            
            const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
            const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
            
            totalTime += hours + (minutes / 60);
            
            console.log(chalk.cyan(`  📌 ${entry.ticketId}: ${entry.taskName} (${entry.timeSpent})`));
            if (entry.comment) {
                console.log(chalk.gray(`     Comment: "${entry.comment}"`));
            }
        });
        
        console.log(chalk.green(`  Total time logged: ${formatTimeSpent(totalTime)}`));
    }
};

/**
 * Update settings.
 */
const updateSettings = async (): Promise<void> => {
    const settings = loadSettings();

    console.log(chalk.blue('⚙️ Update Settings:'));
    
    const { jiraBaseUrl, jiraUsername, jiraApiToken, defaultProject, timeRoundingEnabled, roundTo, gsjbdPath, mappingsPath, defaultCommentTemplate, testConnection } = await inquirer.prompt([
        {
            type: 'input',
            name: 'jiraBaseUrl',
            message: 'Enter Jira base URL:',
            default: settings.jira.baseUrl,
        },
        {
            type: 'input',
            name: 'jiraUsername',
            message: 'Enter Jira username:',
            default: settings.jira.username,
        },
        {
            type: 'input',
            name: 'jiraApiToken',
            message: 'Enter Jira API token:',
            default: settings.jira.apiToken,
        },
        {
            type: 'input',
            name: 'defaultProject',
            message: 'Enter default Jira project key:',
            default: settings.jira.defaultProject,
        },
        {
            type: 'confirm',
            name: 'timeRoundingEnabled',
            message: 'Enable time rounding?',
            default: settings.timeRounding.enabled,
        },
        {
            type: 'number',
            name: 'roundTo',
            message: 'Round time to the nearest (minutes):',
            default: settings.timeRounding.roundTo,
            when: answers => answers.timeRoundingEnabled,
        },
        {
            type: 'input',
            name: 'gsjbdPath',
            message: 'Enter path to Grindstone file:',
            default: settings.fileStorage.gsjbdPath,
        },
        {
            type: 'input',
            name: 'mappingsPath',
            message: 'Enter path to store mappings:',
            default: settings.fileStorage.mappingsPath,
        },
        {
            type: 'input',
            name: 'defaultCommentTemplate',
            message: 'Default comment template (use placeholders: {taskName}, {timeSpent}):',
            default: settings.comments?.defaultTemplate || 'Worked on "{taskName}" for {timeSpent}',
        },
        {
            type: 'confirm',
            name: 'testConnection',
            message: 'Test Jira connection?',
            default: true,
        }
    ]);

    // Save updated settings
    saveSettings({
        jira: {
            baseUrl: jiraBaseUrl,
            username: jiraUsername,
            apiToken: jiraApiToken,
            defaultProject,
        },
        timeRounding: {
            enabled: timeRoundingEnabled,
            roundTo: roundTo || settings.timeRounding.roundTo, // Use existing value if undefined
        },
        fileStorage: {
            gsjbdPath,
            mappingsPath,
        },
        comments: {
            defaultTemplate: defaultCommentTemplate,
        }
    });

    // Test connection if requested
    if (testConnection) {
        try {
            console.log(chalk.blue('🔄 Testing Jira connection...'));
            const projects = await fetchProjects();
            console.log(chalk.green(`✅ Successfully connected to Jira! Found ${projects.length} projects.`));
        } catch (error) {
            console.error(chalk.red('❌ Failed to connect to Jira. Please check your settings.'));
        }
    }

    console.log(chalk.green('✅ Settings updated successfully!'));
};

/**
 * Main CLI function.
 * @param isSettingsMode - If true, skip time logging and open the settings menu.
 * @param autoAction - Automatically select this action ('sync', 'view', etc.)
 */
export const runCLI = async (isSettingsMode: boolean = false, autoAction?: string): Promise<void> => {
    console.log(chalk.bold.blue('🚀 Jira Time Logger CLI'));

    // Step 1: Load settings and logged entries
    const settings = loadSettings();
    const loggedEntries = loadLoggedEntries();
    const taskTicketMappings = loadTaskToTicketMappings();

    if (isSettingsMode) {
        await updateSettings();
        return;
    }

    // Determine action (either from autoAction parameter or user input)
    let action = autoAction;
    
    if (!action) {
        const result = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: 'Log time from Grindstone file', value: 'log' },
                    { name: 'View recent logged entries', value: 'view' },
                    { name: 'Sync task-ticket mappings with Jira', value: 'sync' },
                    { name: 'Update settings', value: 'settings' },
                    { name: 'Exit', value: 'exit' }
                ]
            }
        ]);
        action = result.action;
    }

    if (action === 'exit') {
        console.log(chalk.green('👋 Goodbye!'));
        return;
    }

    if (action === 'settings') {
        await updateSettings();
        return;
    }

    if (action === 'view') {
        await viewLoggedEntries(loggedEntries);
        return;
    }

    if (action === 'sync') {
        console.log(chalk.blue('🔄 Syncing task-ticket mappings with Jira...'));
        const updatedMappings = await syncMappings(taskTicketMappings);
        
        // Count changes
        const removedCount = Object.keys(taskTicketMappings).length - Object.keys(updatedMappings).length;
        
        if (removedCount > 0) {
            console.log(chalk.yellow(`⚠️ Removed ${removedCount} invalid mappings`));
        }
        
        console.log(chalk.green(`✅ Synced ${Object.keys(updatedMappings).length} mappings successfully!`));
        
        // Update mappings file with validated mappings
        for (const [taskName, ticketId] of Object.entries(updatedMappings)) {
            saveTaskToTicketMapping(taskName, ticketId);
        }
        
        return;
    }
    
    // Continue with time logging from here (action === 'log')
    // Step 2: Parse the time log file
    console.log(chalk.blue('📄 Parsing time log file...'));
    
    try {
        const timeEntries = parseFile(settings.fileStorage.gsjbdPath);

        if (timeEntries.length === 0) {
            console.log(chalk.yellow('📄 No time entries found in the file. Exiting.'));
            return;
        }

        console.log(chalk.green(`📄 Found ${timeEntries.length} time entries.`));

        // Check for recent unlogged work
        const recentUnlogged = findRecentUnloggedWork(timeEntries, loggedEntries);
        
        if (recentUnlogged.length > 0) {
            console.log(chalk.blue(`📊 Found ${recentUnlogged.length} recent entries that haven't been logged.`));
        }

        // Step 3: Group time entries by day and task
        const groupedByDayAndTask = groupByDayAndTask(timeEntries);

        if (Object.keys(groupedByDayAndTask).length === 0) {
            console.log(chalk.yellow('📄 No valid time entries found. Exiting.'));
            return;
        }

        // Sort dates in descending order (most recent first)
        const sortedDates = Object.keys(groupedByDayAndTask).sort((a, b) => 
            new Date(b).getTime() - new Date(a).getTime()
        );

        // Allow user to filter by date range
        const { startDate, endDate } = await inquirer.prompt([
            {
                type: 'list',
                name: 'startDate',
                message: 'Select start date:',
                choices: sortedDates.map(date => {
                    const taskCount = Object.keys(groupedByDayAndTask[date]).length;
                    return {
                        name: `${date} (${taskCount} tasks)`,
                        value: date
                    };
                })
            },
            {
                type: 'list',
                name: 'endDate',
                message: 'Select end date:',
                choices: sortedDates.filter(date => date <= sortedDates[0]).map(date => {
                    const taskCount = Object.keys(groupedByDayAndTask[date]).length;
                    return {
                        name: `${date} (${taskCount} tasks)`,
                        value: date
                    };
                })
            }
        ]);

        // Filter dates by selected range
        const filteredDates = sortedDates.filter(date => 
            date >= startDate && date <= endDate
        );

        for (const date of filteredDates) {
            console.log(chalk.bold.blue(`\n📅 Processing entries for ${date}:`));
            
            for (const [taskId, taskInfo] of Object.entries(groupedByDayAndTask[date])) {
                // Check if this task on this date has already been logged
                if (isEntryLogged(taskId, date, loggedEntries)) {
                    console.log(chalk.gray(`⏭️ Task "${taskInfo.taskName}" already logged for ${date}. Skipping.`));
                    continue;
                }
                
                // Step 4: Apply time rounding
                const roundedTime = applyTimeRounding(taskInfo.duration);
                const formattedTimeSpent = formatTimeSpent(roundedTime);
                
                console.log(chalk.bold(`\n🔄 Processing: "${taskInfo.taskName}" on ${date} (${formattedTimeSpent})`));

                // Step 5: Match tickets
                const matchedTickets = await matchTickets(taskInfo.taskName, taskTicketMappings);

                if (matchedTickets.length === 0) {
                    console.log(chalk.yellow(`❌ No matching tickets found for "${taskInfo.taskName}" on ${date}.`));
                    
                    // Ask if user wants to enter a ticket ID manually
                    const { manualEntry, manualTicketId } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'manualEntry',
                            message: 'Would you like to enter a ticket ID manually?',
                            default: false
                        },
                        {
                            type: 'input',
                            name: 'manualTicketId',
                            message: 'Enter Jira ticket ID (e.g., ABC-123):',
                            when: answers => answers.manualEntry,
                            validate: input => /^[A-Z][A-Z0-9_]+-\d+$/.test(input) ? true : 'Please enter a valid Jira ticket ID (e.g., ABC-123)'
                        }
                    ]);
                    
                    if (!manualEntry) {
                        console.log(chalk.gray(`⏩ Skipping logging for "${taskInfo.taskName}" on ${date}`));
                        continue;
                    }
                    
                    // Use the manual ticket ID
                    const ticketId = manualTicketId;
                    
                    // Save this mapping for future use
                    saveTaskToTicketMapping(taskInfo.taskName, ticketId);
                    
                    // Generate a comment for the work log
                    const comment = generateWorkLogComment(taskInfo.taskName, formattedTimeSpent);
                    
                    // Ask for confirmation before logging
                    const { confirmLog } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirmLog',
                            message: `Log ${formattedTimeSpent} to ${ticketId} on ${date}?\nComment: "${comment}"`,
                            default: true
                        }
                    ]);
                    
                    if (!confirmLog) {
                        console.log(chalk.gray(`⏩ Skipping logging for "${taskInfo.taskName}" on ${date}`));
                        continue;
                    }
                    
                    // Log time to Jira
                    await logTimeToJira(
                        ticketId, 
                        taskId, 
                        taskInfo.taskName,
                        formattedTimeSpent, 
                        date, 
                        comment, 
                        loggedEntries
                    );
                    
                    continue;
                }

                let ticketId: string;

                if (matchedTickets.length === 1) {
                    // Auto-select if only one match
                    ticketId = matchedTickets[0].key;
                    console.log(chalk.green(`✓ Found matching ticket: ${ticketId} - ${matchedTickets[0].fields.summary}`));
                } else {
                    // Prompt user to select a ticket
                    console.log(chalk.blue(`${matchedTickets.length} potential matching tickets found:`));
                    
                    const { selectedTicket } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'selectedTicket',
                            message: `Select the correct Jira ticket for "${taskInfo.taskName}":`,
                            choices: matchedTickets.map((ticket: any) => ({
                                name: `${ticket.key}: ${ticket.fields.summary}`,
                                value: ticket.key
                            }))
                        }
                    ]);
                    
                    ticketId = selectedTicket;
                }
                
                // Save this mapping for future use
                saveTaskToTicketMapping(taskInfo.taskName, ticketId);
                
                // Generate a comment for the work log
                const comment = generateWorkLogComment(taskInfo.taskName, formattedTimeSpent);
                
                // Step 6: Ask for confirmation before logging
                const { confirmLog, editComment, customComment } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmLog',
                        message: `Log ${formattedTimeSpent} to ${ticketId} on ${date}?\nComment: "${comment}"`,
                        default: true
                    },
                    {
                        type: 'confirm',
                        name: 'editComment',
                        message: 'Would you like to edit the comment?',
                        default: false,
                        when: answers => answers.confirmLog
                    },
                    {
                        type: 'input',
                        name: 'customComment',
                        message: 'Enter custom comment:',
                        default: comment,
                        when: answers => answers.editComment
                    }
                ]);

                if (!confirmLog) {
                    console.log(chalk.gray(`⏩ Skipping logging for "${taskInfo.taskName}" on ${date}`));
                    continue;
                }
                
                // Use custom comment if provided
                const finalComment = customComment || comment;
                
                // Step 7: Log time to Jira
                await logTimeToJira(
                    ticketId, 
                    taskId, 
                    taskInfo.taskName,
                    formattedTimeSpent, 
                    date, 
                    finalComment, 
                    loggedEntries
                );
            }
        }

        console.log(chalk.green.bold('\n🎉 Time logging complete!'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('❌ An error occurred:'), errorMessage);
    }
};