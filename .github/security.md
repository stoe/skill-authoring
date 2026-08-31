# Security Policy

## Scope

This policy covers the contents of this repository, including the CLI entry point (`cli.js`), source modules under `src/`, tests under `test/`, package metadata, and GitHub Actions workflows.

`@stoe/skill-authoring` validates Markdown skill packages that can be loaded by AI coding agents. Treat content that a skill causes an agent to fetch, read, or execute as untrusted data, not as instructions.

## Reporting a vulnerability

Please **do not** open a public issue for security reports.

Use GitHub's private vulnerability reporting for this repository: [Report a vulnerability](../../security/advisories/new). This keeps the report private until a fix is available.

If private reporting is unavailable, email [security@stoelzle.me](mailto:security@stoelzle.me) instead of filing a public issue.

Please include:

- Affected file or command.
- Steps to reproduce, including any skill content that triggers the issue.
- Potential impact, such as prompt injection, path traversal, arbitrary file write, sensitive data exposure, or supply-chain risk.

## Response expectations

- Acknowledgement within 5 business days.
- Triage and severity assessment within 10 business days.
- A fix or mitigation timeline once triage is complete.

## Responsible disclosure

Please give the maintainer a reasonable opportunity to remediate a report before public disclosure. Coordinated disclosure is preferred. A GitHub Security Advisory will be published once a fix is available and, if applicable, the reporter will be credited with permission.

## Supply chain

The test workflow validates the package on pushes and pull requests. Before release, review dependency changes and run `npm test`.

## Supported versions

The `main` branch is the only supported line. Security fixes land directly on `main`.
