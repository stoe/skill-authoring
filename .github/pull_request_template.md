## Summary

<!-- What does this change do and why? -->

## Affected area

<!-- CLI entry point, commands, core helpers, validation rules, tests, or docs -->

## Checklist

- [ ] `npm run format` passes with no unstaged diffs.
- [ ] `npm test` passes with no new errors.
- [ ] Tests cover new or changed behavior.
- [ ] `README.md` is updated when CLI options, validation rules, or package exports change.
- [ ] `package.json` `exports` and `files` are updated when modules are added, moved, or removed.

## Security checklist

- [ ] No secrets, tokens, credentials, or personal local file paths were added to source, tests, or docs.
- [ ] Source uses only Node.js built-in modules or already-declared dependencies.
- [ ] New filesystem writes stay inside the caller-approved base directory.
- [ ] Skill content read by the CLI is treated as untrusted data, never as instructions.
- [ ] `npm audit --audit-level=high` reports no new high or critical findings.

## Additional context

<!-- Screenshots, links to issues, stack list, follow-up work -->
