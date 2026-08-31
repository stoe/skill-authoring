# skill-authoring

[![test](https://github.com/stoe/skill-authoring/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/skill-authoring/actions/workflows/test.yml)
[![Code Style Prettier](https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> CLI to scaffold and validate GitHub Copilot skill packages (SKILL.md authoring toolkit)

`@stoe/skill-authoring` provides a small, dependency-free command-line tool for creating and validating [Agent Skills](https://docs.github.com/en/copilot) (`SKILL.md`-based packages) for GitHub Copilot. It is designed to work as a standalone package and can be installed and used independently.

## Installation

This package is published to **GitHub Packages**, not npmjs.com. GitHub Packages requires authentication even to install public packages.

Add a `.npmrc` in your project (or `~/.npmrc` for global installs):

```ini
@stoe:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN_OR_PAT}
```

`GITHUB_TOKEN_OR_PAT` must be a GitHub token with at least `read:packages` scope (in GitHub Actions, `secrets.GITHUB_TOKEN` already has this if the job sets `permissions.packages: read`).

Then install:

```sh
# as a global CLI
npm i -g @stoe/skill-authoring

# or as a devDependency in a project
npm i -D @stoe/skill-authoring
```

## CLI usage

### `validate`

Validate skill structure, frontmatter, naming conventions, and resource organization.

```sh
skill-authoring validate --skill <path>
skill-authoring validate --all --path <root>
skill-authoring validate --all --path <root> --format json
skill-authoring validate --all --path <root> --fail-level warning
```

| Option                  | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `-s, --skill <path>`    | Path to a single skill directory to validate                |
| `-a, --all`             | Validate all skills found under `--path`                    |
| `-p, --path <path>`     | Root path for discovering skills (used with `--all`)        |
| `-f, --format <format>` | Output format: `pretty` (default) or `json`                 |
| `--fail-level <level>`  | Exit non-zero at this level: `error` (default) or `warning` |
| `-h, --help`            | Show help                                                   |

Validation covers, among other checks: frontmatter parsing and required fields, `name`/`description` conventions, SKILL.md length (~100 lines target, 5,000 word max), broken relative links, placeholder text, heading hierarchy, extraneous files, and a set of security checks (invisible Unicode, encoded payloads, instruction-override patterns, hardcoded local paths, unsafe reference paths, boundary-language requirements).

### `init`

Scaffold a new skill directory with a `SKILL.md` template and resource folders.

```sh
skill-authoring init <skill-name>
skill-authoring init <skill-name> --force
```

| Option         | Description                          |
| -------------- | ------------------------------------ |
| `<skill-name>` | Skill name (lowercase, hyphens only) |
| `-f, --force`  | Overwrite an existing directory      |
| `-h, --help`   | Show help                            |

## Programmatic API

Internal modules are exposed as package subpath exports, for consumers (such as test suites) that need direct access instead of shelling out to the CLI:

```js
import {validateSkill} from '@stoe/skill-authoring/validate'
import {initCommand} from '@stoe/skill-authoring/commands/init'
import {resolveSafeSkillPath} from '@stoe/skill-authoring/core/fsx'
```

Available subpaths: `.`, `./commands/init`, `./commands/validate`, `./core/discover`, `./core/frontmatter`, `./core/fsx`, `./core/log`, `./core/reporters`, `./validate`, `./validate/micro-templates`, `./validate/security`.

## License

[MIT](./license) © [Stefan Stölzle](https://github.com/stoe)
