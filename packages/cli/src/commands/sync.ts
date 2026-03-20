import { Command } from 'commander';
import { intro, outro, spinner, confirm, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager } from '@jira-logger/config';
import { createJiraClient } from '@jira-logger/jira-api';
import { createTicketMatcher } from '@jira-logger/core';

export const syncCommand = new Command('sync')
  .description('Sync with Jira (validate mappings, fetch projects)')
  .option('--validate-mappings', 'Validate saved ticket mappings')
  .action(async (options) => {
    intro(pc.cyan('🔄 Sync with Jira'));

    const configManager = createConfigManager();
    const config = configManager.load();

    if (!configManager.isComplete()) {
      consola.error(pc.red('❌ Configuration incomplete. Run "jira-time-logger init" first.'));
      process.exit(1);
    }

    const spin = spinner();
    
    // Test connection
    spin.start('Testing Jira connection...');
    
    const jiraClient = createJiraClient(config.jira);
    const testResult = await jiraClient.testConnection();

    if (!testResult.success) {
      spin.stop('Connection failed');
      consola.error(pc.red(`❌ Connection failed: ${testResult.message}`));
      process.exit(1);
    }

    spin.stop(pc.green('✓ Connected to Jira'));

    // Fetch projects
    spin.start('Fetching projects...');
    try {
      const projects = await jiraClient.listProjects();
      spin.stop(`Found ${projects.length} projects`);
      
      consola.log(pc.cyan('\n📁 Available Projects:\n'));
      for (const project of projects.slice(0, 10)) {
        consola.log(`  • ${pc.bold(project.key)} - ${project.name}`);
      }
      if (projects.length > 10) {
        consola.log(pc.dim(`  ... and ${projects.length - 10} more`));
      }
    } catch (error) {
      spin.stop('Failed to fetch projects');
      consola.warn(pc.yellow(`⚠️ Could not fetch projects: ${error instanceof Error ? error.message : error}`));
    }

    // Validate mappings if requested
    if (options.validateMappings) {
      spin.start('Validating ticket mappings...');
      
      const ticketMatcher = createTicketMatcher(jiraClient, []);
      const { valid, invalid } = await ticketMatcher.validateMappings();
      
      spin.stop(`Validation complete`);
      
      consola.log(pc.cyan('\n📋 Mapping Validation:\n'));
      consola.success(pc.green(`✓ ${valid.length} valid mappings`));
      
      if (invalid.length > 0) {
        consola.error(pc.red(`✗ ${invalid.length} invalid mappings removed`));
        for (const mapping of invalid) {
          consola.error(pc.red(`  • ${mapping.taskName} → ${mapping.issueKey}`));
        }
      }
    }

    outro(pc.green('Sync complete!'));
  });
