# skill-authoring

[![test](https://github.com/stoe/skill-authoring/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/skill-authoring/actions/workflows/test.yml)
[![Code Style Prettier](https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> CLI to scaffold and validate GitHub Copilot skill packages (SKILL.md authoring toolkit)

`@stoe/skill-authoring` provides a small command-line tool for creating and validating [Agent Skills](https://docs.github.com/en/copilot) (`SKILL.md`-based packages) for GitHub Copilot. It is designed to work as a standalone package and can be installed and used independently.

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
skill-authoring validate [path]
skill-authoring validate [path] --format json
skill-authoring validate [path] --profile public
skill-authoring validate --all [path]
skill-authoring validate --all [path] --fail-level warning
skill-authoring validate --all <ignored-path> --yes
```

| Argument | Description                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------- |
| `[path]` | Skill directory or `SKILL.md` file; defaults to the current directory. With `--all`, must be a directory. |

| Option                  | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `-a, --all`             | Recursively discover and validate skills below `[path]`               |
| `-y, --yes`             | Confirm scanning an explicitly requested path ignored by `.gitignore` |
| `-f, --format <format>` | Output format: `pretty` (default) or `json`                           |
| `--profile <profile>`   | Policy profile: `standard` (default), `public`, or `private`          |
| `--fail-level <level>`  | Exit non-zero at this level: `error` (default) or `warning`           |
| `-h, --help`            | Show help                                                             |

Without `--all`, validation targets exactly one skill: the directory at `[path]` or the parent directory of a supplied `SKILL.md` file. Descendant directories are not searched. When `[path]` is omitted, the current directory is validated.

With `--all`, `[path]` must be a directory and becomes the recursive discovery root. The starting directory and every non-ignored real descendant directory are scanned, including skills nested below other skills. Directory symlinks are not followed. When `[path]` is omitted, discovery starts from the current directory.

Recursive discovery honors `.gitignore` files at every directory level with Git-style matching and negation. If an explicitly supplied recursive root is ignored by rules from its containing Git repository, the CLI warns and asks for confirmation. Use `--yes` to confirm in advance; non-interactive execution exits non-zero unless `--yes` is present. After confirmation, ignore rules inside the selected root still apply.

Filename discovery is case-insensitive so directories containing variants such as `skill.md` are not silently skipped. Validation still requires the canonical exact filename `SKILL.md`, and non-canonical variants receive a `skill.missing` error.

Pretty output identifies each validation target by its absolute skill directory path.

JSON output includes each skill's absolute directory `path`, structured `errors` and `warnings` arrays, direct `errorCount` and `warningCount` values, and aggregate totals. Issue-level `path` values remain relative to the skill directory when the source file is known, or `null` otherwise:

```json
{
  "skills": [
    {
      "name": "example-skill",
      "path": "/absolute/path/to/example-skill",
      "errors": [{"code": "skill.missing", "message": "SKILL.md not found", "path": "SKILL.md"}],
      "warnings": [],
      "errorCount": 1,
      "warningCount": 0
    }
  ],
  "summary": {
    "totalErrors": 1,
    "totalWarnings": 0
  }
}
```

Validation covers, among other checks: frontmatter parsing and required fields, `name`/`description` conventions, SKILL.md length (~100 lines target, 5,000 word max), broken relative links, placeholder text, heading hierarchy, extraneous files, and a set of security checks (invisible Unicode, encoded payloads, instruction-override patterns, hardcoded local paths, unsafe reference paths, boundary-language requirements).

### Validation profiles

- `standard` preserves the default validation behavior for existing consumers.
- `public` treats hardcoded local paths as errors and rejects known private or authenticated-only URLs plus the `.private` marker.
- `private` permits documented private references while retaining the shared structural and security checks.

Profiles classify distribution policy; they do not prove that content is safe, public, authorized, or correctly governed.

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

## Repository file handling

Install [Git LFS](https://git-lfs.com/) before adding or updating binary documents or images outside skill directories. The root [`.gitattributes`](.gitattributes) normalizes text files to LF, stores supported binary formats in LFS, and marks intentionally tracked build output as generated. Skill-bundled binaries remain ordinary Git objects so installed skills receive complete files. Disposable `coverage/`, `dist/`, and `build/` directories remain ignored.

After changing covered files, verify their attributes and pointers:

```sh
git check-attr --all -- path/to/file
git lfs ls-files
```

## Community

- Read the [contribution guide](.github/contributing.md) before opening a pull request.
- Review the [Code of Conduct](.github/code_of_conduct.md) for community expectations.
- Follow the [security policy](.github/security.md) to report vulnerabilities privately.
- See the [support guide](.github/support.md) for help and feature requests.

## License

[MIT](./license) © [Stefan Stölzle](https://github.com/stoe)
