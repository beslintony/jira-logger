#!/usr/bin/env node

import { Command } from 'commander';
import { runCLI } from './cli';
import { initializeSettings, validateSettings, loadSettings } from './setttings';
import chalk from 'chalk';
import { findRecentUnloggedWork, loadLoggedEntries } from './utils';
import { parseFile } from './parser';

// Initialize settings if not already done
initializeSettings();

// Set up the CLI using commander
const program = new Command();

program
  .name('jira-time-logger')
  .description('A CLI tool to log time to Jira from time-tracking files.')
  .version('1.1.0');

// Main command: Run the CLI
program
  .command('run')
  .description('Start the Jira Time Logger CLI')
  .action(() => {
    runCLI().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ An error occurred:'), errorMessage);
      process.exit(1);
    });
  });

// Command to update settings
program
  .command('settings')
  .description('Update Jira Time Logger settings')
  .action(() => {
    runCLI(true).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ An error occurred:'), errorMessage);
      process.exit(1);
    });
  });

// Command to sync mappings
program
  .command('sync')
  .description('Sync task-ticket mappings with Jira')
  .action(() => {
    // This will run the CLI and auto-select the sync option
    runCLI(false, 'sync').catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ An error occurred:'), errorMessage);
      process.exit(1);
    });
  });

// Command to view logged entries
program
  .command('view')
  .description('View recent logged entries')
  .action(() => {
    // This will run the CLI and auto-select the view option
    runCLI(false, 'view').catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ An error occurred:'), errorMessage);
      process.exit(1);
    });
  });

// Command to check for unlogged work
program
  .command('check')
  .description('Check for recent unlogged work')
  .option('-d, --days <days>', 'Number of days to check', '7')
  .action((options) => {
    const days = parseInt(options.days);
    
    try {
      const settings = loadSettings();
      const loggedEntries = loadLoggedEntries();
      const timeEntries = parseFile(settings.fileStorage.gsjbdPath);
      
      const unloggedWork = findRecentUnloggedWork(timeEntries, loggedEntries, days);
      
      if (unloggedWork.length === 0) {
        console.log(chalk.green('✅ No unlogged work found in the last', days, 'days.'));
        return;
      }
      
      console.log(chalk.yellow(`⚠️ Found ${unloggedWork.length} unlogged time entries in the last ${days} days:`));
      
      // Group by date
      const entriesByDate: Record<string, any[]> = {};
      
      unloggedWork.forEach(entry => {
        const date = new Date(entry.start).toISOString().split('T')[0];
        if (!entriesByDate[date]) {
          entriesByDate[date] = [];
        }
        entriesByDate[date].push(entry);
      });
      
      // Display unlogged entries grouped by date
      for (const [date, entries] of Object.entries(entriesByDate)) {
        console.log(chalk.bold(`\n📅 ${date}:`));
        
        let totalTime = 0;
        entries.forEach(entry => {
          totalTime += entry.duration;
          console.log(chalk.cyan(`  📌 ${entry.taskName} (${(entry.duration).toFixed(2)} hours)`));
        });
        
        console.log(chalk.green(`  Total unlogged time: ${totalTime.toFixed(2)} hours`));
      }
      
      console.log(chalk.blue('\nRun "jira-time-logger run" to log these entries.'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ An error occurred:'), errorMessage);
      process.exit(1);
    }
  });

// Parse command-line arguments
program.parse(process.argv);

// Default to run if no command is provided
if (!process.argv.slice(2).length) {
  runCLI().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('❌ An error occurred:'), errorMessage);
    process.exit(1);
  });
}