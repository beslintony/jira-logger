import { Command } from 'commander';
import { intro, outro, select, text, spinner, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createGrindstoneParser, createCSVParser, globalParserRegistry } from '@jira-logger/parsers';
import { createTimeEntryService } from '@jira-logger/core';
import { existsSync } from 'node:fs';

export const importCommand = new Command('import')
  .description('Import time entries from file')
  .argument('<source>', 'Source type (grindstone, csv)')
  .argument('[path]', 'Path to file')
  .option('--mapping <columns>', 'CSV column mapping (e.g., task:Task,start:Start)')
  .action(async (source, path, options) => {
    intro(pc.cyan('📥 Import Time Entries'));

    const configManager = createConfigManager();
    const config = configManager.load();

    // Determine source type
    let sourceType = source;
    let filePath = path;

    if (!filePath) {
      // Try to get path from config
      const configuredSource = config.sources[0];
      if (configuredSource && 'path' in configuredSource) {
        filePath = configuredSource.path;
      }
    }

    if (!filePath) {
      const enteredPath = await text({
        message: 'Enter path to time tracking file:',
        validate: (value) => {
          if (!value) return 'Path is required';
          if (!existsSync(value)) return 'File not found';
          return undefined;
        },
      });

      if (isCancel(enteredPath)) {
        cancel('Import cancelled');
        process.exit(0);
      }

      filePath = enteredPath as string;
    }

    if (!existsSync(filePath as string)) {
      consola.error(pc.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }

    // Create appropriate parser
    const spin = spinner();
    spin.start('Parsing time entries...');

    try {
      let parser;
      
      if (sourceType === 'grindstone') {
        parser = createGrindstoneParser();
      } else if (sourceType === 'csv') {
        // Parse mapping option
        const mapping: Record<string, string> = {
          taskName: 'task',
          startTime: 'start',
          endTime: 'end',
        };

        if (options.mapping) {
          const pairs = options.mapping.split(',');
          for (const pair of pairs) {
            const [key, value] = pair.split(':');
            if (key && value) {
              mapping[key.trim()] = value.trim();
            }
          }
        }

        parser = createCSVParser({
          mapping: {
            taskName: mapping.taskName || 'task',
            startTime: mapping.startTime || 'start',
            endTime: mapping.endTime || 'end',
          },
        });
      } else {
        spin.stop('Unknown source type');
        consola.error(pc.red(`❌ Unknown source type: ${sourceType}`));
        consola.log(pc.dim('Supported types: grindstone, csv'));
        process.exit(1);
      }

      // Validate and parse
      const validation = await parser.validate(filePath as string);
      if (!validation.valid) {
        spin.stop('Validation failed');
        consola.error(pc.red('❌ File validation failed:'));
        for (const error of validation.errors) {
          consola.error(pc.red(`  • ${error}`));
        }
        process.exit(1);
      }

      const entries = await parser.parse(filePath as string);
      spin.stop(`Parsed ${entries.length} time entries`);

      // Group by date
      const timeService = createTimeEntryService();
      const grouped = timeService.groupByDate(entries);
      const dates = Object.keys(grouped).sort();

      consola.log(pc.dim(`\n📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`));
      consola.log(pc.dim(`📊 Total duration: ${timeService.formatDuration(
        entries.reduce((sum, e) => sum + e.duration, 0)
      )}`));

      // Show preview
      consola.log(pc.cyan('\n📋 Entries by date:\n'));
      for (const date of dates) {
        const tasks = grouped[date] || [];
        consola.log(pc.bold(date));
        for (const task of tasks) {
          consola.log(`  • ${task.taskName}: ${timeService.formatDuration(task.totalDuration)}`);
        }
      }

      outro(pc.green(`✅ Successfully imported ${entries.length} entries`));
    } catch (error) {
      spin.stop('Import failed');
      consola.error(pc.red(`❌ Import failed: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
