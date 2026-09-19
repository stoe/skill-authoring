#!/usr/bin/env node

/**
 * Skill Authoring CLI
 * Main entry point
 */

import {parseArgs} from 'util'
import {validateCommand} from './src/commands/validate.js'
import {initCommand} from './src/commands/init.js'
import {createLogger} from './src/core/log.js'

const logger = createLogger('info')

async function main() {
  const args = process.argv.slice(2)

  // Handle global --help or -h
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    showHelp('validate')
    process.exit(0)
  }

  const command = args[0] || 'validate'

  const options = {
    skill: {type: 'string', short: 's', description: 'Path to skill directory'},
    all: {type: 'boolean', short: 'a', description: 'Validate all skills'},
    path: {type: 'string', short: 'p', description: 'Root path for discovering skills (for --all)'},
    format: {type: 'string', short: 'f', default: 'pretty', description: 'Output format: pretty|json'},
    profile: {
      type: 'string',
      default: 'standard',
      description: 'Validation policy profile: standard|public|private',
    },
    'fail-level': {type: 'string', description: 'Exit with error if this level is reached'},
    failLevel: {type: 'string', default: 'error', description: 'Exit with error if this level is reached'},
    name: {type: 'string', short: 'n', description: 'Skill name (for init)'},
    template: {type: 'string', default: 'basic', description: 'Skill template (for init)'},
    force: {type: 'boolean', short: 'f', description: 'Force overwrite (for init)'},
    help: {type: 'boolean', short: 'h', description: 'Show help'},
  }

  try {
    const parsed = parseArgs({
      args: args.slice(1),
      options,
      allowPositionals: true,
    })

    if (parsed.values.help) {
      showHelp(command)
      process.exit(0)
    }

    if (command === 'validate') {
      const exitCode = await validateCommand({
        skill: parsed.values.skill,
        all: parsed.values.all || false,
        rootDir: parsed.values.path || parsed.positionals[0],
        format: parsed.values.format,
        profile: parsed.values.profile,
        failLevel: parsed.values['fail-level'] || parsed.values.failLevel,
      })
      process.exit(exitCode)
    } else if (command === 'init') {
      const exitCode = await initCommand({
        name: parsed.values.name || parsed.positionals[0],
        outputDir: '.',
        force: parsed.values.force || false,
      })
      process.exit(exitCode)
    } else {
      logger.error(`Unknown command: ${command}`)
      showHelp(command)
      process.exit(1)
    }
  } catch (error) {
    logger.error(error.message)
    process.exit(1)
  }
}

function showHelp(command) {
  if (command === 'init') {
    console.log(`
Usage: skill-authoring.js init <skill-name> [options]

Initialize a new skill directory structure with SKILL.md template and resource directories.

Arguments:
  <skill-name>            Skill name (lowercase, hyphens only)

Options:
  -f, --force             Force overwrite if directory exists
  -h, --help              Show this help message

Example:
  skill-authoring.js init my-skill
  skill-authoring.js init my-skill --force
`)
  } else {
    console.log(`
Usage: skill-authoring.js validate [options] [path]

Validate skill structure, frontmatter, naming conventions, and resource organization.

Options:
  -s, --skill <path>      Path to skill directory to validate
  -a, --all               Validate all skills in workspace
  -p, --path <path>       Root path for discovering skills (used with --all)
  -f, --format <format>   Output format: pretty (default) or json
  --profile <profile>     Policy profile: standard (default), public, or private
  --fail-level <level>    Exit with error for this level: error (default) or warning
  -h, --help              Show this help message

Validation rules:
  - SKILL.md: target ~100 lines, max 120 with 20% buffer (max 5000 words, excluding frontmatter)
  - Description: max 1024 characters; should include trigger contexts (USE WHEN, etc.)
  - File references inside fenced code blocks (\`\`\`) are ignored and not checked.

Commands:
  validate               Validate skill structure (default command)
  init <skill-name>      Initialize a new skill
  help                   Show help

Examples:
  skill-authoring.js validate --skill ./my-skill
  skill-authoring.js validate --all
  skill-authoring.js validate --all ./skills
  skill-authoring.js validate --all --path ./skills
  skill-authoring.js validate --skill ./my-skill --format json
  skill-authoring.js validate --skill ./my-skill --profile public
  skill-authoring.js validate --all --fail-level warning
`)
  }
}

main().catch(error => {
  logger.error(error.message)
  process.exit(1)
})
