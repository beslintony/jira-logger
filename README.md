# Jira Time Logger v2.0

A modern CLI tool to log time from various time-tracking sources to Jira.

[![CI](https://github.com/beslintony/jira-time-logger/actions/workflows/ci.yml/badge.svg)](https://github.com/beslintony/jira-time-logger/actions)
[![npm version](https://img.shields.io/npm/v/jira-time-logger.svg)](https://www.npmjs.com/package/jira-time-logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔌 **Multiple Sources** - Import from Grindstone, Toggl, Clockify, or generic CSV
- 🔍 **Smart Matching** - Automatically matches tasks to Jira tickets
- ⏱️ **Time Rounding** - Configurable time rounding rules
- 👀 **Preview Mode** - Preview work logs before sending to Jira
- 🔒 **Secure** - API tokens stored safely, never in plain text
- 🎨 **Modern UI** - Beautiful interactive prompts with progress indicators
- 📊 **Statistics** - View time tracking statistics and reports

## Installation

```bash
npm install -g jira-time-logger
```

Or with pnpm:

```bash
pnpm add -g jira-time-logger
```

## Quick Start

### 1. Initialize Configuration

```bash
jira-time-logger init
```

This interactive wizard will guide you through:
- Jira connection settings (URL, username, API token)
- Time tracking source selection
- Time rounding preferences

### 2. Import Time Entries

```bash
jira-time-logger import grindstone /path/to/time-tracking.gsjbd
```

### 3. Preview Work Logs

```bash
jira-time-logger preview
```

### 4. Log Time to Jira

```bash
jira-time-logger log
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize configuration interactively |
| `config` | View and manage configuration |
| `config get <key>` | Get a specific config value |
| `config set <key> <value>` | Set a config value |
| `config view` | View full configuration |
| `config reset` | Reset to defaults |
| `import <source> [path]` | Import time entries from file |
| `preview` | Preview work logs before sending |
| `log` | Log time entries to Jira |
| `log --dry-run` | Preview without logging |
| `status` | Check status of unlogged work |
| `sync` | Sync with Jira and validate mappings |
| `sync --validate-mappings` | Validate saved ticket mappings |

## Configuration

Configuration is stored in your system's config directory:

- **macOS**: `~/Library/Preferences/jira-time-logger/config.json`
- **Linux**: `~/.config/jira-time-logger/config.json`
- **Windows**: `%APPDATA%/jira-time-logger/config.json`

### Example Configuration

```json
{
  "version": "2.0.0",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "username": "user@example.com",
    "apiToken": "***",
    "defaultProject": "PROJ"
  },
  "timeRounding": {
    "enabled": true,
    "roundToMinutes": 15
  },
  "sources": [
    {
      "type": "grindstone",
      "path": "/path/to/time-tracking.gsjbd"
    }
  ]
}
```

## Supported Time Tracking Sources

### Grindstone (.gsjbd)
```bash
jira-time-logger import grindstone /path/to/file.gsjbd
```

### CSV
```bash
jira-time-logger import csv /path/to/timesheet.csv --mapping "task:Task,start:Start,end:End"
```

## Development

### Setup

```bash
git clone https://github.com/beslintony/jira-time-logger.git
cd jira-time-logger
pnpm install
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Lint

```bash
pnpm lint
pnpm format
```

## Architecture

This project uses a monorepo structure with pnpm workspaces:

- `@jira-logger/config` - Configuration management with Zod validation
- `@jira-logger/parsers` - Time tracking file parsers
- `@jira-logger/jira-api` - Jira REST API client
- `@jira-logger/core` - Business logic and ticket matching
- `@jira-logger/cli` - CLI interface

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Reporting issues
- Suggesting features
- Submitting pull requests

## Security

Please report security vulnerabilities to [beslintony@gmail.com](mailto:beslintony@gmail.com).
See [SECURITY.md](./SECURITY.md) for details.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## License

MIT © [Tony Benslin](https://github.com/beslintony)
