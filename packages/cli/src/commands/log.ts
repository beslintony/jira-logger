import { Command } from 'commander';
import { intro, outro, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createGrindstoneParser } from '@jira-logger/parsers';
import { createJiraClient } from '@jira-logger/jira-api';
import { createTimeEntryService, createTicketMatcher, createWorkLogService } from '@jira-logger/core';

export const logCommand = new Command('log')
  .description('Log time entries to Jira')
  .option('--date <date>', 'Specific date to log (YYYY-MM-DD)')
  .option('--dry-run', 'Preview without actually logging')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (options) => {
    intro(pc.cyan('🚀 Log Time to Jira'));

    const configManager = createConfigManager();
    const config = configManager.load();

    if (!configManager.isComplete()) {
      consola.error(pc.red('❌ Configuration incomplete. Run "jira-time-logger init" first.'));
      process.exit(1);
    }

    const source = config.sources[0];
    if (!source || !('path' in source) || !source.path) {
      consola.error(pc.red('❌ No file source configured'));
      process.exit(1);
    }

    const spin = spinner();
    spin.start('Loading and matching entries...');

    try {
      // Parse entries
      const parser = createGrindstoneParser();
      const entries = await parser.parse(source.path);
      
      if (entries.length === 0) {
        spin.stop('No entries found');
        consola.warn(pc.yellow('⚠️ No time entries found'));
        process.exit(0);
      }

      // Group by date
      const timeService = createTimeEntryService();
      const grouped = timeService.groupByDate(entries);
      const dates = options.date 
        ? [options.date]
        : Object.keys(grouped).sort();

      // Initialize services
      const jiraClient = createJiraClient(config.jira);
      const ticketMatcher = createTicketMatcher(jiraClient, []);
      const workLogService = createWorkLogService(jiraClient, timeService, ticketMatcher);

      // Collect entries to log
      const entriesToLog: Array<{
        date: string;
        task: {
          taskId: string;
          taskName: string;
          totalDuration: number;
          entries: typeof entries;
        };
        issueKey: string;
      }> = [];

      // In dry-run mode, extract ticket IDs from task names without calling Jira
      if (options.dryRun) {
        spin.stop('Analysis complete');
        
        for (const date of dates) {
          const tasks = grouped[date] || [];
          
          for (const task of tasks) {
            // Extract ticket ID from task name (e.g., "PROJ-123 Task name")
            const ticketMatch = task.taskName.match(/\b([A-Z][A-Z0-9_]*-\d+)\b/);
            const ticketId = ticketMatch?.[1];
            if (ticketId) {
              entriesToLog.push({
                date,
                task,
                issueKey: ticketId,
              });
            }
          }
        }
        
        if (entriesToLog.length === 0) {
          consola.warn(pc.yellow('\n⚠️ No entries with ticket IDs found in task names'));
          consola.log(pc.dim('Tip: Include ticket IDs like PROJ-123 in your task names'));
          process.exit(0);
        }

        consola.log(pc.cyan('\n📋 Entries that would be logged:\n'));
        for (const entry of entriesToLog) {
          const duration = config.timeRounding.enabled
            ? timeService.applyRounding(entry.task.totalDuration, {
                roundToMinutes: config.timeRounding.roundToMinutes,
              })
            : entry.task.totalDuration;
          
          consola.log(`  ${entry.date} | ${pc.green(entry.issueKey)} | ${entry.task.taskName} | ${timeService.formatDuration(duration)}`);
        }
        
        consola.log(pc.yellow('\n🧪 Dry run mode - no changes made'));
        outro('Preview complete');
        return;
      }

      // Normal mode: Match tickets via Jira API
      for (const date of dates) {
        const tasks = grouped[date] || [];
        
        for (const task of tasks) {
          const matches = await ticketMatcher.match(task.taskName);
          
          const firstMatch = matches[0];
          if (firstMatch) {
            entriesToLog.push({
              date,
              task,
              issueKey: firstMatch.issue.key,
            });
          }
        }
      }

      spin.stop(`Found ${entriesToLog.length} entries to log`);

      if (entriesToLog.length === 0) {
        consola.warn(pc.yellow('\n⚠️ No entries with matching tickets found'));
        process.exit(0);
      }

      // Verify issues exist before logging
      consola.log(pc.dim('\n🔍 Verifying issues exist...\n'));
      const missingIssues: string[] = [];
      for (const entry of entriesToLog) {
        const exists = await jiraClient.issueExists(entry.issueKey);
        if (!exists) {
          missingIssues.push(entry.issueKey);
          consola.error(pc.red(`✗ ${entry.issueKey}: Issue not found or not accessible`));
        } else {
          consola.success(pc.green(`✓ ${entry.issueKey}: Found`));
        }
      }
      
      if (missingIssues.length > 0) {
        consola.error(pc.red(`\n❌ ${missingIssues.length} issue(s) not found in Jira`));
        consola.log(pc.dim('\nPlease check:'));
        consola.log(pc.dim('  • The issue keys are correct'));
        consola.log(pc.dim('  • You have permission to view these issues'));
        consola.log(pc.dim('  • The issues are in your configured project'));
        process.exit(1);
      }

      // Preview
      consola.log(pc.cyan('\n📋 Entries to log:\n'));
      for (const entry of entriesToLog) {
        const duration = config.timeRounding.enabled
          ? timeService.applyRounding(entry.task.totalDuration, {
              roundToMinutes: config.timeRounding.roundToMinutes,
            })
          : entry.task.totalDuration;
        
        consola.log(`  ${entry.date} | ${pc.green(entry.issueKey)} | ${entry.task.taskName} | ${timeService.formatDuration(duration)}`);
      }

      // Confirm
      if (!options.yes) {
        const confirmed = await confirm({
          message: `\nLog ${entriesToLog.length} work logs to Jira?`,
          initialValue: true,
        });

        if (isCancel(confirmed) || !confirmed) {
          cancel('Logging cancelled');
          process.exit(0);
        }
      }

      // Log entries
      consola.log('\n');
      const logOptions: { roundingRule?: { roundToMinutes: number }; onProgress?: (result: import('@jira-logger/core').LogResult) => void } = {};
      if (config.timeRounding.enabled) {
        logOptions.roundingRule = { roundToMinutes: config.timeRounding.roundToMinutes };
      }
      logOptions.onProgress = (result) => {
        if (result.success) {
          consola.success(pc.green(`✓ ${result.issueKey}: ${result.timeSpent}`));
        } else {
          consola.error(pc.red(`✗ ${result.issueKey}: ${result.error}`));
        }
      };

      let results: import('@jira-logger/core').LogResult[] = [];
      try {
        results = await workLogService.logMultiple(
          entriesToLog.map(e => ({
            ...e.task,
            matchedIssue: { key: e.issueKey } as import('@jira-logger/jira-api').JiraIssue,
          })),
          logOptions
        );
      } catch (error) {
        consola.log('');
        if (error instanceof Error && error.message.includes('410')) {
          consola.error(pc.red('\n❌ Jira API Error 410 Gone'));
          consola.error(pc.yellow('\nThis error typically means:'));
          consola.log('  1. The Jira API endpoint is deprecated');
          consola.log('  2. You are using Jira Server/Data Center (not Cloud)');
          consola.log('  3. The issue key does not exist or is not accessible');
          consola.log('\nPossible solutions:');
          consola.log('  • Check your Jira base URL is correct');
          consola.log('  • Verify the issue keys exist in your project');
          consola.log('  • If using Jira Server, the API endpoints may differ');
          consola.log('  • Run "jira-time-logger sync" to test the connection');
        } else {
          consola.error(pc.red(`\n❌ ${error instanceof Error ? error.message : error}`));
        }
        process.exit(1);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      consola.log('');
      if (successCount > 0) {
        consola.success(pc.green(`✓ Successfully logged ${successCount} work logs`));
      }
      if (failCount > 0) {
        consola.error(pc.red(`✗ Failed to log ${failCount} work logs`));
      }

      outro('Done!');
    } catch (error) {
      spin.stop('Logging failed');
      consola.error(pc.red(`❌ Logging failed: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
