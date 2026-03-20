import { Command } from 'commander';
import { intro, outro, select, confirm, multiselect, spinner, isCancel, cancel, text } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createGrindstoneParser } from '@jira-logger/parsers';
import { createJiraClient, defaultTemplates, findTemplate, type TicketTemplate } from '@jira-logger/jira-api';
import { createTimeEntryService } from '@jira-logger/core';

export const createTicketsCommand = new Command('create-tickets')
  .description('Create Jira tickets for time entries without matching issues')
  .option('--template <name>', 'Template to use (task, development, meeting, bug, research)')
  .option('--dry-run', 'Preview tickets without creating')
  .option('--date <date>', 'Specific date to process (YYYY-MM-DD)')
  .action(async (options) => {
    intro(pc.cyan('🎫 Create Jira Tickets from Time Entries'));

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

    // Parse entries
    const spin = spinner();
    spin.start('Loading time entries...');

    let entries: import('@jira-logger/parsers').TimeEntry[];
    try {
      const parser = createGrindstoneParser();
      entries = await parser.parse(source.path);
      
      if (entries.length === 0) {
        spin.stop('No entries found');
        consola.warn(pc.yellow('⚠️ No time entries found'));
        process.exit(0);
      }
    } catch (error) {
      spin.stop('Failed to load entries');
      consola.error(pc.red(`❌ Failed to load time entries: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }

    // Group by date
    const timeService = createTimeEntryService();
    const grouped = timeService.groupByDate(entries);
    const dates = options.date ? [options.date] : Object.keys(grouped).sort();

    spin.stop(`Loaded ${entries.length} entries`);

    // Find entries without ticket IDs
    const entriesWithoutTickets: Array<{
      date: string;
      task: {
        taskId: string;
        taskName: string;
        totalDuration: number;
        entries: typeof entries;
      };
    }> = [];

    for (const date of dates) {
      const tasks = grouped[date] || [];
      for (const task of tasks) {
        // Check if task name contains a ticket ID
        const hasTicketId = /\b[A-Z][A-Z0-9_]*-\d+\b/.test(task.taskName);
        if (!hasTicketId) {
          entriesWithoutTickets.push({ date, task });
        }
      }
    }

    if (entriesWithoutTickets.length === 0) {
      consola.success(pc.green('\n✅ All entries have ticket IDs! No tickets need to be created.'));
      outro('Done!');
      return;
    }

    consola.log(pc.cyan(`\n📋 Found ${entriesWithoutTickets.length} entries without ticket IDs:\n`));
    for (const entry of entriesWithoutTickets) {
      consola.log(`  ${entry.date} | ${entry.task.taskName} | ${timeService.formatDuration(entry.task.totalDuration)}`);
    }

    // Select template
    let selectedTemplate: TicketTemplate;
    
    if (options.template) {
      const template = findTemplate(defaultTemplates, options.template);
      if (!template) {
        consola.error(pc.red(`❌ Template "${options.template}" not found`));
        consola.log(pc.dim(`Available templates: ${defaultTemplates.map(t => t.name).join(', ')}`));
        process.exit(1);
      }
      selectedTemplate = template;
    } else {
      const templateChoice = await select({
        message: 'Select a ticket template:',
        options: defaultTemplates.map(t => ({
          value: t.name,
          label: `${t.name} - ${t.description}`,
        })),
      });

      if (isCancel(templateChoice)) {
        cancel('Cancelled');
        process.exit(0);
      }

      const template = findTemplate(defaultTemplates, templateChoice as string);
      if (!template) {
        consola.error(pc.red('❌ Template not found'));
        process.exit(1);
      }
      selectedTemplate = template;
    }

    consola.success(pc.green(`\n✓ Using template: ${selectedTemplate.name}`));
    consola.log(pc.dim(`  Issue type: ${selectedTemplate.issueType}`));
    if (selectedTemplate.labels) {
      consola.log(pc.dim(`  Labels: ${selectedTemplate.labels.join(', ')}`));
    }

    // Show preview
    consola.log(pc.cyan('\n📋 Tickets to create:\n'));
    
    const currentDate = new Date().toISOString().split('T')[0] ?? '';
    
    for (const entry of entriesWithoutTickets) {
      const context = {
        taskName: entry.task.taskName,
        date: entry.date,
        duration: entry.task.totalDuration,
        durationFormatted: timeService.formatDuration(entry.task.totalDuration),
        taskId: entry.task.taskId,
        currentDate,
        userName: config.jira.username.split('@')[0] ?? '',
      };

      const summary = selectedTemplate.summaryTemplate.replace(/{taskName}/g, context.taskName);
      
      consola.log(pc.bold(`${config.jira.defaultProject}: ${summary}`));
      consola.log(pc.dim(`  Type: ${selectedTemplate.issueType}`));
      consola.log(pc.dim(`  Time: ${context.durationFormatted} on ${context.date}`));
      consola.log('');
    }

    // Dry run
    if (options.dryRun) {
      consola.log(pc.yellow('🧪 Dry run mode - no tickets created'));
      outro('Preview complete');
      return;
    }

    // Confirm
    const confirmed = await confirm({
      message: `Create ${entriesWithoutTickets.length} tickets in project ${config.jira.defaultProject}?`,
      initialValue: true,
    });

    if (isCancel(confirmed) || !confirmed) {
      cancel('Cancelled');
      process.exit(0);
    }

    // Create tickets
    const jiraClient = createJiraClient(config.jira);
    const results: Array<{ success: boolean; taskName: string; issueKey?: string; error?: string }> = [];

    consola.log('\n');
    for (const entry of entriesWithoutTickets) {
      const context = {
        taskName: entry.task.taskName,
        date: entry.date,
        duration: entry.task.totalDuration,
        durationFormatted: timeService.formatDuration(entry.task.totalDuration),
        taskId: entry.task.taskId,
        currentDate,
        userName: config.jira.username.split('@')[0] ?? '',
      };

      try {
        const issue = await jiraClient.createIssueFromTemplate(
          selectedTemplate,
          context,
          config.jira.defaultProject
        );
        
        results.push({
          success: true,
          taskName: entry.task.taskName,
          issueKey: issue.key,
        });
        
        consola.success(pc.green(`✓ Created ${issue.key}: ${issue.fields.summary}`));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Log detailed error for debugging
        if (error && typeof error === 'object' && 'data' in error) {
          const jiraError = error as { 
            status?: number;
            data?: { errorMessages?: string[]; errors?: Record<string, string> } 
          };
          
          // Handle specific error cases
          if (jiraError.status === 401) {
            consola.error(pc.red('\n  ⚠️  Permission denied'));
            consola.error(pc.yellow('\n  Your Jira account does not have permission to create issues.'));
            consola.log(pc.dim('\n  Possible solutions:'));
            consola.log(pc.dim('    1. Check that you have "Create Issues" permission in project ' + config.jira.defaultProject));
            consola.log(pc.dim('    2. Verify your API token has the required scopes'));
            consola.log(pc.dim('    3. Contact your Jira administrator'));
          } else if (jiraError.data?.errorMessages) {
            consola.error(pc.red('\n  Error details:'));
            for (const msg of jiraError.data.errorMessages) {
              consola.error(pc.red(`    - ${msg}`));
            }
          }
          if (jiraError.data?.errors) {
            for (const [field, msg] of Object.entries(jiraError.data.errors)) {
              consola.error(pc.red(`    - ${field}: ${msg}`));
            }
          }
        }
        
        results.push({
          success: false,
          taskName: entry.task.taskName,
          error: errorMsg,
        });
        consola.error(pc.red(`✗ Failed: ${entry.task.taskName} - ${errorMsg}`));
      }
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    consola.log('');
    if (successCount > 0) {
      consola.success(pc.green(`✓ Created ${successCount} tickets`));
    }
    if (failCount > 0) {
      consola.error(pc.red(`✗ Failed to create ${failCount} tickets`));
    }

    // Suggest next steps
    if (successCount > 0) {
      consola.log(pc.dim('\nNext steps:'));
      consola.log(pc.dim('  1. Run "jira-time-logger log" to log time to the new tickets'));
      consola.log(pc.dim('  2. Review the created tickets in Jira'));
    }

    outro('Done!');
  });
