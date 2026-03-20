# Security Policy

## Supported Versions

The following versions of Jira Time Logger are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.1.x   | :x:                |
| < 1.1   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

📧 [beslintony@gmail.com](mailto:beslintony@gmail.com)

Please include the following information in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Affected versions**
- **Potential impact**
- **Suggested fix** (if you have one)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.

2. **Assessment**: We will assess the report and determine its impact.

3. **Fix Development**: We will work on a fix and may reach out for additional information.

4. **Disclosure**: Once the fix is released, we will:
   - Credit you in the release notes (unless you prefer to remain anonymous)
   - Publish a security advisory
   - Update this security policy if needed

### Response Time

We aim to respond to security reports according to the following timeline:

| Severity | Initial Response | Fix Released |
|----------|-----------------|--------------|
| Critical | 24 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 72 hours | 30 days |
| Low | 1 week | 90 days |

## Security Best Practices

### For Users

1. **Keep your API tokens secure**
   - Never commit API tokens to version control
   - Use environment variables or secure credential storage
   - Rotate your API tokens regularly

2. **Use the latest version**
   - Keep the tool updated to receive security patches
   - Subscribe to security advisories

3. **Review permissions**
   - Use Jira API tokens with minimal required permissions
   - Regularly audit what the tool has access to

### For Contributors

1. **Dependencies**
   - Keep dependencies up to date
   - Run `pnpm audit` regularly
   - Address security warnings promptly

2. **Code Reviews**
   - All code changes must be reviewed
   - Pay special attention to:
     - Input validation
     - Authentication/authorization
     - Data handling
     - External API calls

3. **Testing**
   - Include security tests where applicable
   - Test edge cases and invalid inputs

## Known Security Considerations

### API Token Storage

- API tokens are stored in your system's config directory
- On supported systems, we use OS keychain/keystore when possible
- File permissions are set to be readable only by the owner

### Network Security

- All API calls use HTTPS
- No sensitive data is logged or sent to third parties
- Jira API credentials are never included in error messages

## Security-Related Configuration

### Environment Variables

You can use environment variables for configuration:

```bash
export JIRA_BASE_URL="https://company.atlassian.net"
export JIRA_USERNAME="user@example.com"
export JIRA_API_TOKEN="your-token"
```

### Secure Mode

For CI/CD environments, use non-interactive mode:

```bash
jira-time-logger log --yes --config /secure/path/config.json
```

## Acknowledgments

We thank the following individuals for responsibly disclosing security issues:

*None yet - be the first!*

## Contact

For security-related questions or concerns, contact:

📧 [beslintony@gmail.com](mailto:beslintony@gmail.com)
