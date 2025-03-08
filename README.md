# Jira Time Logger

A basic CLI tool for logging time from Grindstone time tracking files to Jira.

## Features

- **Smart Ticket Matching**: Automatically matches Grindstone tasks to Jira tickets
- **Task-to-Ticket Mapping**: Maintains a mapping database for consistent logging
- **Time Rounding**: Option to round time to the nearest X minutes
- **Work Log Comments**: Generates meaningful comments with customization options
- **Interactive CLI**: User-friendly interface with colorful output
- **Date Range Selection**: Choose date ranges for logging
- **Filtering & Validation**: Skip already logged entries and verify tickets

## Prerequisites

1. A Jira account with API access
2. Grindstone time tracking files (.gsjbd)
3. Node.js 18.0.0 or higher

## Getting Started

1. **Initialize the tool**:
   ```bash
   npm start settings
   ```
   You'll be prompted to enter your Jira credentials and other settings.

2. **Log time**:
   ```bash
   npm start run
   ```
   The tool will guide you through the time logging process.

## Commands

- `npm start` - Start the interactive CLI
- `npm start settings` - Update settings
- `npm start sync` - Sync task-ticket mappings with Jira
- `npm start view` - View recent logged entries
- `npm start check` - Check for unlogged work
- `npm start check --days 14` - Check unlogged work from the last 14 days

## Configuration

When running the settings command, you'll be asked to provide:

### Jira Settings
- **Base URL**: Your Jira instance URL (e.g., `https://your-domain.atlassian.net`)
- **Username**: Your Jira username (email)
- **API Token**: Your Jira API token ([how to get a token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/))
- **Default Project**: The key of your default Jira project (e.g., `PROJ`)

### Time Rounding
- **Enable/Disable**: Whether to round time entries
- **Round To**: Round to the nearest X minutes (e.g., 15)

### File Paths
- **Grindstone Path**: Path to your .gsjbd file
- **Mappings Path**: Path to store mappings data

### Other Settings
- **Comment Template**: Template for work log comments
- **Test Connection**: Option to test Jira connection

## How It Works

1. **Parsing**: Reads time entries from your Grindstone file
2. **Grouping**: Groups entries by day and task
3. **Matching**: Matches tasks to Jira tickets using various methods:
   - Exact ticket ID in task name (e.g., "PROJ-123 Task name")
   - Text similarity matching
   - Previously saved mappings
4. **Logging**: Logs time to Jira with appropriate comments
5. **Saving**: Saves mappings for future use

## Tips

- **Task Naming**: Include the Jira ticket ID in your Grindstone task names for automatic matching
- **Regular Sync**: Use the `sync` command to keep your mappings up to date
- **Check Command**: Use the `check` command to find unlogged work before running the main tool

## FAQ

### How are task names matched to Jira tickets?
The tool uses a multi-step approach:
1. Check if there's a saved mapping
2. Look for a Jira ticket ID in the task name (e.g., "PROJ-123")
3. Compare task name with ticket summaries for similarity
4. If multiple matches are found, you'll be prompted to select the correct one

### Can I log time to closed tickets?
Yes, but you'll receive a warning before logging.

### What happens if I've already logged time for a task?
The tool checks for previously logged entries and skips them to avoid duplication.

### Can I customize the comment format?
Yes, you can customize the default comment template in settings and also edit comments before logging.

## Troubleshooting

### Error: "Failed to connect to Jira"
Check your Jira URL, username, and API token in settings.

### Error: "File not found"
Make sure your Grindstone file path is correct in settings.

### No tickets found
Check that your default project key is correct and you have access to the project.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.