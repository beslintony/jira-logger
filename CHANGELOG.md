# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2024-03-20

### Added
- Complete rewrite with modern TypeScript and ESM modules
- Monorepo structure with pnpm workspaces
- New package: `@jira-logger/config` - Configuration management with Zod validation
- New package: `@jira-logger/parsers` - Time tracking file parsers (Grindstone, CSV)
- New package: `@jira-logger/jira-api` - Jira REST API v3 client with retry logic
- New package: `@jira-logger/core` - Business logic and ticket matching
- New package: `@jira-logger/cli` - Modern CLI with interactive prompts
- Interactive init wizard with connection testing
- Smart ticket matching with text similarity
- Time rounding configuration
- Preview mode for work logs
- Dry-run mode for safe testing
- Status command for checking unlogged work
- Comprehensive test suite with Vitest
- Biome for linting and formatting

### Changed
- Switched from CommonJS to ESM modules
- Switched from npm to pnpm
- Switched from Jest to Vitest for testing
- Switched from ESLint/Prettier to Biome
- Migrated from inquirer to @clack/prompts
- Modern CLI UI with progress indicators and spinners

### Removed
- Support for Node.js < 18
- Old CommonJS build output

## [1.1.0] - 2024-01-15

### Added
- Initial release of Jira Time Logger
- Grindstone .gsjbd file parsing
- Interactive CLI with Commander
- Basic Jira API integration
- Time rounding functionality
- Task-to-ticket mapping persistence

[Unreleased]: https://github.com/beslintony/jira-time-logger/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/beslintony/jira-time-logger/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/beslintony/jira-time-logger/releases/tag/v1.1.0
