import { Command } from 'commander';
import { intro, outro, text, confirm, password, select, isCancel, cancel } from '@clack/prompts';
import { consola } from 'consola';
import pc from 'picocolors';
import { createJiraClient } from '@jira-logger/jira-api';
import { createConfigManager, getDefaultConfig } from '@jira-logger/config';
import { setGlobalConfigPath } from '../utils/config.js';

export const initCommand = new Command('init')
  .description('Initialize Jira Time Logger configuration')
  .action(async () => {
    intro(pc.cyan('🔧 Jira Time Logger Setup'));

    const configManager = createConfigManager();
    const defaultConfig = getDefaultConfig();

    // Jira Configuration
    consola.log(pc.dim('\n📡 Jira Configuration\n'));

    const baseUrl = await text({
      message: 'Enter your Jira base URL:',
      placeholder: 'https://company.atlassian.net',
      validate: (value) => {
        if (!value) return 'Base URL is required';
        if (!value.startsWith('http')) return 'URL must start with http:// or https://';
        return undefined;
      },
    });

    if (isCancel(baseUrl)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    const username = await text({
      message: 'Enter your Jira username (email):',
      placeholder: 'user@example.com',
      validate: (value) => {
        if (!value) return 'Username is required';
        if (!value.includes('@')) return 'Please enter a valid email';
        return undefined;
      },
    });

    if (isCancel(username)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    const apiToken = await password({
      message: 'Enter your Jira API token:',
      validate: (value) => {
        if (!value) return 'API token is required';
        return undefined;
      },
    });

    if (isCancel(apiToken)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    const defaultProject = await text({
      message: 'Enter your default project key:',
      placeholder: 'PROJ',
      validate: (value) => {
        if (!value) return 'Project key is required';
        if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
          return 'Project key must be uppercase letters, numbers, or underscores';
        }
        return undefined;
      },
    });

    if (isCancel(defaultProject)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    // Test connection
    consola.log(pc.dim('\n🔄 Testing Jira connection...\n'));

    const jiraClient = createJiraClient({
      baseUrl: baseUrl as string,
      username: username as string,
      apiToken: apiToken as string,
    });

    const testResult = await jiraClient.testConnection();

    if (!testResult.success) {
      consola.error(pc.red(`❌ Connection failed: ${testResult.message}`));
      const continueAnyway = await confirm({
        message: 'Connection failed. Continue with setup anyway?',
        initialValue: false,
      });

      if (isCancel(continueAnyway) || !continueAnyway) {
        cancel('Setup cancelled');
        process.exit(0);
      }
    } else {
      consola.success(pc.green(`✓ Connected! ${testResult.message}`));
    }

    // Time Tracking Source
    consola.log(pc.dim('\n📁 Time Tracking Source\n'));

    const sourceType = await select({
      message: 'Select your time tracking source:',
      options: [
        { value: 'grindstone', label: 'Grindstone (.gsjbd file)' },
        { value: 'csv', label: 'Generic CSV file' },
      ],
    });

    if (isCancel(sourceType)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    let source;
    if (sourceType === 'grindstone') {
      const path = await text({
        message: 'Enter path to your .gsjbd file:',
        placeholder: '/path/to/time-tracking.gsjbd',
        validate: (value) => {
          if (!value) return 'Path is required';
          return undefined;
        },
      });

      if (isCancel(path)) {
        cancel('Setup cancelled');
        process.exit(0);
      }

      source = { type: 'grindstone' as const, path: path as string };
    } else {
      const path = await text({
        message: 'Enter path to your CSV file:',
        placeholder: '/path/to/timesheet.csv',
        validate: (value) => {
          if (!value) return 'Path is required';
          return undefined;
        },
      });

      if (isCancel(path)) {
        cancel('Setup cancelled');
        process.exit(0);
      }

      source = {
        type: 'csv' as const,
        path: path as string,
        mapping: {
          taskName: 'task',
          startTime: 'start',
          endTime: 'end',
        },
      };
    }

    // Time Rounding
    consola.log(pc.dim('\n⏱️ Time Rounding\n'));

    const enableRounding = await confirm({
      message: 'Enable time rounding?',
      initialValue: false,
    });

    if (isCancel(enableRounding)) {
      cancel('Setup cancelled');
      process.exit(0);
    }

    let roundToMinutes = 15;
    if (enableRounding) {
      const minutes = await text({
        message: 'Round to nearest (minutes):',
        placeholder: '15',
        initialValue: '15',
        validate: (value) => {
          const num = parseInt(value || '0', 10);
          if (isNaN(num) || num < 1 || num > 60) {
            return 'Please enter a number between 1 and 60';
          }
          return undefined;
        },
      });

      if (isCancel(minutes)) {
        cancel('Setup cancelled');
        process.exit(0);
      }

      roundToMinutes = parseInt(minutes as string, 10);
    }

    // Save configuration
    const config = {
      ...defaultConfig,
      jira: {
        baseUrl: baseUrl as string,
        username: username as string,
        apiToken: apiToken as string,
        defaultProject: defaultProject as string,
      },
      sources: [source],
      timeRounding: {
        enabled: enableRounding,
        roundToMinutes,
      },
    };

    try {
      configManager.save(config);
      outro(pc.green(`✅ Configuration saved to ${configManager.getConfigPath()}`));
      consola.log(pc.dim('\nNext steps:'));
      consola.log(pc.dim('  • Run "jira-time-logger import" to import time entries'));
      consola.log(pc.dim('  • Run "jira-time-logger preview" to preview work logs'));
      consola.log(pc.dim('  • Run "jira-time-logger log" to log time to Jira\n'));
    } catch (error) {
      consola.error(pc.red(`❌ Failed to save configuration: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
