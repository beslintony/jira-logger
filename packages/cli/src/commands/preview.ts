import { Command } from 'commander';
import { intro, outro, select, multiselect, confirm, spinner, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createGrindstoneParser } from '@jira-logger/parsers';
import { createJiraClient } from '@jira-logger/jira-api';
import { createTimeEntryService, createTicketMatcher, createWorkLogService } from '@jira-logger/core';

export const previewCommand = new Command('preview')
  .description('Preview work logs before sending to Jira')
  .option('--date <date>', 'Specific date to preview (YYYY-MM-DD)')
  .option('--dry-run', 'Show preview without interactive prompts')
  .action(async (options) => {
    intro(pc.cyan('👀 Preview Work Logs'));

    const configManager = createConfigManager();
    const config = configManager.load();

    // Check if config is complete
    if (!configManager.isComplete()) {
      consola.error(pc.red('❌ Configuration incomplete. Run "jira-time-logger init" first.'));
      process.exit(1);
    }

    // Get source file
    const source = config.sources[0];
    if (!source || !('path' in source) || !source.path) {
      consola.error(pc.red('❌ No file source configured'));
      process.exit(1);
    }

    const spin = spinner();
    spin.start('Loading time entries...');

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

      // Filter by date if specified
      const dates = options.date 
        ? [options.date]
        : Object.keys(grouped).sort();

      if (dates.length === 0) {
        spin.stop('No entries for date');
        consola.warn(pc.yellow(`⚠️ No entries for date: ${options.date}`));
        process.exit(0);
      }

      spin.stop(`Loaded ${entries.length} entries`);

      // Initialize Jira client and services
      const jiraClient = createJiraClient(config.jira);
      const ticketMatcher = createTicketMatcher(jiraClient, []);
      const workLogService = createWorkLogService(jiraClient, timeService, ticketMatcher);

      // Preview for each date
      const previews: Array<{
        date: string;
        taskName: string;
        issueKey: string;
        timeSpent: string;
        comment: string;
      }> = [];

      for (const date of dates) {
        const tasks = grouped[date] || [];
        
        for (const task of tasks) {
          // Match ticket
          const matches = await ticketMatcher.match(task.taskName);
          const firstMatch = matches[0];
          
          if (!firstMatch) {
            previews.push({
              date,
              taskName: task.taskName,
              issueKey: pc.yellow('(no match)'),
              timeSpent: timeService.formatDuration(task.totalDuration),
              comment: '',
            });
            continue;
          }

          const issueKey = firstMatch.issue.key;
          const duration = config.timeRounding.enabled
            ? timeService.applyRounding(task.totalDuration, {
                roundToMinutes: config.timeRounding.roundToMinutes,
              })
            : task.totalDuration;

          const timeSpent = timeService.formatDuration(duration);
          const comment = `Worked on "${task.taskName.replace(/\b[A-Z][A-Z0-9_]*-\d+\b/, '').trim()}" for ${timeSpent}`;

          previews.push({
            date,
            taskName: task.taskName,
            issueKey: pc.green(issueKey),
            timeSpent,
            comment,
          });
        }
      }

      // Display preview
      consola.log(pc.cyan('\n📋 Work Log Preview:\n'));
      consola.log(pc.dim('Date       | Issue     | Task                          | Duration'));
      consola.log(pc.dim('-----------|-----------|-------------------------------|----------'));

      for (const preview of previews) {
        const taskName = preview.taskName.length > 29 
          ? preview.taskName.slice(0, 26) + '...' 
          : preview.taskName.padEnd(29);
        
        consola.log(
          `${preview.date} | ${preview.issueKey.padEnd(9)} | ${taskName} | ${preview.timeSpent}`
        );
      }

      const validPreviews = previews.filter(p => !p.issueKey.includes('no match'));
      
      if (validPreviews.length === 0) {
        consola.warn(pc.yellow('\n⚠️ No valid ticket matches found'));
        consola.log(pc.dim('Run "jira-time-logger sync" to update ticket mappings'));
      } else {
        consola.success(pc.green(`\n✓ ${validPreviews.length} work logs ready to send`));
        consola.log(pc.dim('\nRun "jira-time-logger log" to send these work logs to Jira'));
      }

      outro('Preview complete');
    } catch (error) {
      spin.stop('Preview failed');
      consola.error(pc.red(`❌ Preview failed: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
