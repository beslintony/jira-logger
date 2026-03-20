---
'@jira-logger/config': major
'@jira-logger/parsers': major
'@jira-logger/jira-api': major
'@jira-logger/core': major
'@jira-logger/cli': major
---

# Jira Time Logger v2.0.0

## Major Release

Complete rewrite of Jira Time Logger with modern tooling and architecture.

### New Features
- Monorepo structure with 5 specialized packages
- Modern TypeScript with ESM modules
- Interactive CLI with @clack/prompts
- Smart ticket matching with text similarity
- Multiple time tracking sources (Grindstone, CSV)
- Time rounding configuration
- Preview mode for work logs
- Dry-run mode for safe testing

### Breaking Changes
- Requires Node.js 18+
- Switched from CommonJS to ESM
- New configuration format
- New CLI commands and options

### Technical Improvements
- pnpm workspaces for monorepo management
- Vitest for testing
- Biome for linting and formatting
- GitHub Actions for CI/CD
- Changesets for versioning
