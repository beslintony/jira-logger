import { Command } from 'commander';
import { intro, outro, spinner } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createGrindstoneParser } from '@jira-logger/parsers';
import { createTimeEntryService } from '@jira-logger/core';

export const statusCommand = new Command('status')
  .description('Check status of unlogged work')
  .option('--days <days>', 'Number of days to check', '7')
  .action(async (options) => {
    intro(pc.cyan('📊 Status Check'));

    const configManager = createConfigManager();
    const config = configManager.load();

    const source = config.sources[0];
    if (!source || !('path' in source) || !source.path) {
      consola.error(pc.red('❌ No file source configured'));
      process.exit(1);
    }

    const days = parseInt(options.days, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const spin = spinner();
    spin.start('Analyzing time entries...');

    try {
      const parser = createGrindstoneParser();
      const entries = await parser.parse(source.path);
      
      if (entries.length === 0) {
        spin.stop('No entries found');
        consola.warn(pc.yellow('⚠️ No time entries found'));
        process.exit(0);
      }

      // Filter by date range
      const recentEntries = entries.filter(e => 
        new Date(e.start) >= cutoffDate
      );

      const timeService = createTimeEntryService();
      const stats = timeService.calculateStats(recentEntries);

      spin.stop('Analysis complete');

      // Display statistics
      consola.log(pc.cyan(`\n📈 Last ${days} Days Summary\n`));
      consola.log(`Total Entries: ${stats.totalEntries}`);
      consola.log(`Total Duration: ${timeService.formatDuration(stats.totalDuration)}`);
      consola.log(`Unique Tasks: ${stats.uniqueTasks}`);
      consola.log(`Days with entries: ${Object.keys(stats.entriesPerDay).length}`);

      // Show daily breakdown
      if (Object.keys(stats.durationPerDay).length > 0) {
        consola.log(pc.cyan('\n📅 Daily Breakdown:\n'));
        const sortedDates = Object.keys(stats.durationPerDay).sort();
        for (const date of sortedDates) {
          const duration = stats.durationPerDay[date] || 0;
          const entryCount = stats.entriesPerDay[date] || 0;
          const bar = '█'.repeat(Math.min(Math.round(duration), 8));
          consola.log(`${date} | ${bar.padEnd(8)} | ${timeService.formatDuration(duration).padEnd(10)} | ${entryCount} entries`);
        }
      }

      outro('Status check complete');
    } catch (error) {
      spin.stop('Status check failed');
      consola.error(pc.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
