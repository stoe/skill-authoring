/**
 * Init command - scaffolds a new skill
 */

import path from 'path'
import {writeText, fileExists, resolveSafeSkillPath} from '../core/fsx.js'
import {createLogger} from '../core/log.js'

export async function initCommand(args = {}) {
  const {name, outputDir = '.', force = false, baseDir = process.cwd(), logLevel = 'info'} = args
  const logger = createLogger(logLevel)

  if (!name) {
    logger.error('Skill name is required')
    return 1
  }

  // Validate name
  if (!/^[a-z0-9-]+$/.test(name)) {
    logger.error('Skill name must contain only lowercase letters, numbers, and hyphens')
    return 1
  }

  if (/(anthropic|claude)/.test(name)) {
    logger.error('Skill name cannot contain reserved words: anthropic, claude')
    return 1
  }

  // Keep the scaffold confined to the caller-approved base directory (rejects
  // `outputDir` traversal like `../../etc` or absolute paths outside base).
  const resolved = resolveSafeSkillPath(baseDir, outputDir, name)
  if (!resolved.safe) {
    logger.error(resolved.reason)
    return 1
  }

  const skillPath = resolved.skillPath
  const skillMdPath = path.join(skillPath, 'SKILL.md')

  // Check if skill already exists
  if (await fileExists(skillMdPath)) {
    if (!force) {
      logger.error(`Skill directory already exists at ${skillPath}. Use --force to overwrite.`)
      return 1
    }
    logger.warn(`Overwriting existing skill at ${skillPath}`)
  }

  try {
    // Create template
    const currentDate = new Date().toISOString().slice(0, 10)
    const template = `---
name: ${name}
description: What this skill does. Use when [triggers and contexts].
license: MIT. See LICENSE file for details.
metadata:
  author: Your Name <your@email.com>
  version: "0.1.0"
  last-updated: ${currentDate}
---

# Skill Name

Brief description of what this skill provides and when to use it.

## When to Use

- Specific use case 1
- Specific use case 2
- Specific use case 3

## Quick Start

[Basic usage example]

## Detailed Guidance

[Core instructions]

### [Section 1]

[Instructions]

### [Section 2]

[Instructions]

## Examples

[Concrete examples if needed]

## References

For additional details:
- [Link to reference files if created]

## Next Steps

[What to do after using this skill]
`

    await writeText(skillMdPath, template)

    logger.success(`Created skill directory structure at: ${skillPath}`)
    logger.success(`Created SKILL.md template`)
    logger.info(`Next steps:`)
    logger.info(`1. Edit ${path.join(skillPath, 'SKILL.md')}`)
    logger.info(`2. Update frontmatter (name, description, author)`)
    logger.info(`3. Add bundled resources as needed`)
    logger.info(`4. Test skill activation`)

    return 0
  } catch (err) {
    logger.error(`Failed to create skill: ${err.message}`)
    return 1
  }
}
