# Contributing

Thanks for contributing to `@stoe/skill-authoring`. Keep changes focused, reviewable, and documented when they change the CLI or its public API.

## Before you start

- Use Node.js 22 or newer.
- Run `npm ci` for a clean, reproducible install.
- Do not add secrets, credentials, personal data, or hardcoded local paths to the repository.

## Project structure

- `cli.js` is the command-line entry point.
- `src/commands/` contains the `init` and `validate` commands.
- `src/core/` contains shared filesystem, discovery, logging, frontmatter, and reporting helpers.
- `src/validate/` contains skill validation and security checks.
- `test/` contains Node.js test files that mirror the source layout.
- `.github/workflows/` contains test and publishing automation.

## Development workflow

1. Check open issues and pull requests to avoid duplicate work.
2. Keep each change focused on one outcome.
3. Update `README.md` when CLI behavior, package exports, installation, or validation rules change.
4. Add or update tests with behavior changes.
5. Run `npm test` before opening a pull request.

## Releases

This package is published to GitHub Packages when a GitHub Release is published. The release workflow uses the package metadata in `package.json`.

## Pull request expectations

When you open a pull request:

- Explain why the change is needed.
- Describe what changed.
- Summarize the relevant validation.
- Link related issues when applicable.
- Avoid unrelated cleanup in the same pull request.

## Security

Do not open public issues for suspected vulnerabilities. Follow [the security policy](security.md) to report them privately.

## Questions and support

Use [the support guide](support.md) for the best route for bug reports, feature requests, and usage questions.
