#!/usr/bin/env node

import { Command } from 'commander';
import { consola } from 'consola';
import pc from 'picocolors';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { importCommand } from './commands/import.js';
import { previewCommand } from './commands/preview.js';
import { logCommand } from './commands/log.js';
import { statusCommand } from './commands/status.js';
import { syncCommand } from './commands/sync.js';
import { createTicketsCommand } from './commands/create-tickets.js';

const program = new Command();

program
  .name('jira-time-logger')
  .description('A modern CLI tool to log time to Jira from various time-tracking sources')
  .version('2.0.0')
  .option('--config <path>', 'Path to custom config file')
  .option('--verbose', 'Enable verbose output')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.verbose) {
      consola.level = 4; // Debug level
    }
  });

// Register commands
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(importCommand);
program.addCommand(previewCommand);
program.addCommand(logCommand);
program.addCommand(statusCommand);
program.addCommand(syncCommand);
program.addCommand(createTicketsCommand);

// Default action - show help
program.action(() => {
  consola.log(pc.cyan('\n🚀 Jira Time Logger v2.0\n'));
  program.help();
});

// Parse arguments
program.parse();
