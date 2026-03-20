import { Command } from 'commander';
import { intro, outro, select, text, confirm, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createConfigManager, getDefaultConfig } from '@jira-logger/config';

export const configCommand = new Command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('get')
      .description('Get configuration value')
      .argument('<key>', 'Configuration key (e.g., jira.baseUrl)')
      .action(async (key) => {
        const configManager = createConfigManager();
        const config = configManager.load();

        const parts = key.split('.');
        let value: unknown = config;

        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = (value as Record<string, unknown>)[part];
          } else {
            consola.error(pc.red(`Configuration key not found: ${key}`));
            process.exit(1);
          }
        }

        if (typeof value === 'object') {
          consola.log(JSON.stringify(value, null, 2));
        } else {
          consola.log(String(value));
        }
      })
  )
  .addCommand(
    new Command('set')
      .description('Set configuration value')
      .argument('<key>', 'Configuration key (e.g., jira.baseUrl)')
      .argument('<value>', 'Configuration value')
      .action(async (key, value) => {
        const configManager = createConfigManager();
        const config = configManager.load();

        const parts = key.split('.');
        let current: Record<string, unknown> = config as Record<string, unknown>;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] !== 'object') {
            consola.error(pc.red(`Invalid configuration key: ${key}`));
            process.exit(1);
          }
          current = current[part] as Record<string, unknown>;
        }

        const lastPart = parts[parts.length - 1];
        
        // Parse value
        let parsedValue: unknown = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);

        current[lastPart] = parsedValue;

        try {
          configManager.save(config as typeof configManager.load extends () => infer R ? R : never);
          consola.success(pc.green(`✓ Set ${key} = ${value}`));
        } catch (error) {
          consola.error(pc.red(`Failed to save configuration: ${error instanceof Error ? error.message : error}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('view')
      .description('View full configuration')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        const configManager = createConfigManager();
        const config = configManager.load();

        // Remove sensitive data
        const sanitized = {
          ...config,
          jira: {
            ...config.jira,
            apiToken: config.jira.apiToken ? '***' : '',
          },
        };

        if (options.json) {
          consola.log(JSON.stringify(sanitized, null, 2));
        } else {
          consola.log(pc.cyan('\n📋 Configuration\n'));
          consola.log(`Version: ${sanitized.version}`);
          consola.log(`\nJira:`);
          consola.log(`  Base URL: ${sanitized.jira.baseUrl || '(not set)'}`);
          consola.log(`  Username: ${sanitized.jira.username || '(not set)'}`);
          consola.log(`  API Token: ${sanitized.jira.apiToken ? '***' : '(not set)'}`);
          consola.log(`  Default Project: ${sanitized.jira.defaultProject || '(not set)'}`);
          consola.log(`\nTime Rounding:`);
          consola.log(`  Enabled: ${sanitized.timeRounding.enabled}`);
          consola.log(`  Round To: ${sanitized.timeRounding.roundToMinutes} minutes`);
          consola.log(`\nSources:`);
          for (const source of sanitized.sources) {
            consola.log(`  - ${source.type}: ${'path' in source ? source.path : 'API'}`);
          }
        }
      })
  )
  .addCommand(
    new Command('reset')
      .description('Reset configuration to defaults')
      .action(async () => {
        const confirmed = await confirm({
          message: 'Are you sure you want to reset all configuration?',
          initialValue: false,
        });

        if (isCancel(confirmed) || !confirmed) {
          cancel('Reset cancelled');
          process.exit(0);
        }

        const configManager = createConfigManager();
        configManager.reset();
        consola.success(pc.green('✓ Configuration reset to defaults'));
      })
  );

// Default action - interactive config editor
configCommand.action(async () => {
  intro(pc.cyan('⚙️ Configuration Manager'));

  const action = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'view', label: 'View configuration' },
      { value: 'edit', label: 'Edit configuration' },
      { value: 'reset', label: 'Reset to defaults' },
      { value: 'exit', label: 'Exit' },
    ],
  });

  if (isCancel(action) || action === 'exit') {
    outro('Goodbye!');
    process.exit(0);
  }

  if (action === 'view') {
    const configManager = createConfigManager();
    const config = configManager.load();
    const sanitized = {
      ...config,
      jira: {
        ...config.jira,
        apiToken: config.jira.apiToken ? '***' : '',
      },
    };
    consola.log(JSON.stringify(sanitized, null, 2));
  } else if (action === 'reset') {
    const confirmed = await confirm({
      message: 'Are you sure you want to reset all configuration?',
      initialValue: false,
    });

    if (!isCancel(confirmed) && confirmed) {
      const configManager = createConfigManager();
      configManager.reset();
      consola.success(pc.green('✓ Configuration reset'));
    }
  }

  outro('Done!');
});
