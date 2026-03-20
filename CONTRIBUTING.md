# Contributing to Jira Time Logger

Thank you for your interest in contributing to Jira Time Logger! This document provides guidelines for contributing to the project.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

1. Check if the issue already exists in the [issue tracker](https://github.com/beslintony/jira-time-logger/issues)
2. Update to the latest version to see if the bug is already fixed

When creating a bug report, please include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details**: OS, Node.js version, package version
- **Error messages** and stack traces

Use the [Bug Report template](https://github.com/beslintony/jira-time-logger/issues/new?template=bug_report.yml) when possible.

### Suggesting Features

Feature requests are welcome! Please:

1. Check if the feature is already requested or implemented
2. Provide a clear use case and describe the problem you're trying to solve
3. Explain why this feature would be useful to most users

Use the [Feature Request template](https://github.com/beslintony/jira-time-logger/issues/new?template=feature_request.yml) when possible.

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes
4. Ensure tests pass:
   ```bash
   pnpm test
   ```
5. Ensure linting passes:
   ```bash
   pnpm lint
   pnpm format
   ```
6. Commit your changes following our [commit convention](#commit-convention)
7. Push to your fork and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- pnpm 8.0.0 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/beslintony/jira-time-logger.git
cd jira-time-logger

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
jira-time-logger/
├── packages/
│   ├── cli/          # CLI interface
│   ├── core/         # Business logic
│   ├── jira-api/     # Jira API client
│   ├── parsers/      # Time tracking parsers
│   └── config/       # Configuration management
├── e2e/              # End-to-end tests
└── docs/             # Documentation
```

### Making Changes

1. **Create a branch** from `main`:
   - `feat/` for new features
   - `fix/` for bug fixes
   - `docs/` for documentation changes
   - `refactor/` for code refactoring
   - `test/` for test changes

2. **Write code** following our style guidelines

3. **Add tests** for new functionality

4. **Update documentation** if needed

5. **Run the full test suite**:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

## Coding Guidelines

### TypeScript

- Use strict TypeScript with all strict flags enabled
- Prefer `interface` over `type` for object shapes
- Use explicit return types on exported functions
- Avoid `any` - use `unknown` with type guards instead

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- 100 character line width

### Testing

- Write unit tests for all new functionality
- Aim for >90% code coverage
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

Example:

```typescript
describe('TimeEntryService', () => {
  describe('groupByDate', () => {
    it('should group entries by date correctly', () => {
      // Arrange
      const entries = createTestEntries();
      
      // Act
      const grouped = service.groupByDate(entries);
      
      // Assert
      expect(grouped).toHaveLength(2);
    });
  });
});
```

### Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Build process or auxiliary tool changes

**Scopes:**
- `cli` - CLI package
- `core` - Core package
- `jira-api` - Jira API package
- `parsers` - Parsers package
- `config` - Config package
- `root` - Root-level changes

Examples:

```
feat(cli): add interactive init command
fix(core): handle empty time entries
docs(readme): update installation instructions
```

## Release Process

1. Changes are accumulated on the `main` branch
2. Maintainers create a changeset using `pnpm changeset`
3. When ready to release:
   - `pnpm changeset version` bumps versions
   - `pnpm changeset publish` publishes to npm
4. GitHub releases are created automatically

## Getting Help

- [GitHub Discussions](https://github.com/beslintony/jira-time-logger/discussions) - General questions
- [Discord](#) - Real-time chat (coming soon)
- [Issues](https://github.com/beslintony/jira-time-logger/issues) - Bug reports and features

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
