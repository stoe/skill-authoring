/**
 * Validate command - checks skill structure and content
 */

import path from 'path'
import fs from 'node:fs/promises'
import {createInterface} from 'node:readline/promises'
import {discoverSkills, inspectDiscoveryRoot} from '../core/discover.js'
import {validateSkill} from '../validate/index.js'
import {createReporter, reportBatch} from '../core/reporters.js'

export async function validateCommand(args = {}) {
  const {
    target,
    all = false,
    targetExplicit = Boolean(target),
    yes = false,
    confirmIgnoredRoot = promptForIgnoredRoot,
    format = 'pretty',
    profile = 'standard',
    failLevel = 'error',
  } = args

  if (!['error', 'warning'].includes(failLevel)) {
    throw new Error(`Invalid fail level: ${failLevel}. Expected 'error' or 'warning'.`)
  }

  if (!['standard', 'public', 'private'].includes(profile)) {
    throw new Error(`Invalid profile: ${profile}. Expected 'standard', 'public', or 'private'.`)
  }

  const reporter = createReporter(format)
  const results = []

  let skillPaths = []
  const resolvedTarget = path.resolve(target || '.')

  if (all) {
    await requireDirectoryTarget(resolvedTarget)
    skillPaths = await discoverFromRoot(resolvedTarget, {targetExplicit, yes, confirmIgnoredRoot})
  } else {
    skillPaths = [await resolveSingleTarget(resolvedTarget)]
  }

  for (const skillPath of skillPaths) {
    const result = await validateSkill(skillPath, {profile})
    results.push(result)

    if (format === 'pretty') {
      reporter(result)
    }
  }

  // Report batch summary
  const exitCode = reportBatch(results, format, failLevel)
  return exitCode
}

async function resolveSingleTarget(targetPath) {
  const stat = await statTarget(targetPath)

  if (stat.isDirectory()) {
    return targetPath
  }

  if (stat.isFile() && path.basename(targetPath).toLowerCase() === 'skill.md') {
    return path.dirname(targetPath)
  }

  throw new Error(`Validation target must be a skill directory or SKILL.md file: ${targetPath}`)
}

async function requireDirectoryTarget(targetPath) {
  const stat = await statTarget(targetPath)
  if (!stat.isDirectory()) {
    throw new Error(`Recursive validation target must be a directory: ${targetPath}`)
  }
}

async function statTarget(targetPath) {
  try {
    return await fs.stat(targetPath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Validation target not found: ${targetPath}`)
    }
    throw error
  }
}

async function discoverFromRoot(rootDir, {targetExplicit, yes, confirmIgnoredRoot}) {
  const rootStatus = await inspectDiscoveryRoot(rootDir)

  if (targetExplicit && rootStatus.ignored) {
    console.error(`Warning: requested path is ignored by .gitignore rules: ${rootDir}`)

    if (!yes && !(await confirmIgnoredRoot(rootDir))) {
      throw new Error(`Refusing to scan ignored path without confirmation. Rerun with --yes: ${rootDir}`)
    }
  }

  return discoverSkills(rootDir, {
    rootStatus,
    allowIgnoredRoot: targetExplicit && rootStatus.ignored,
  })
}

async function promptForIgnoredRoot(rootDir) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    return false
  }

  const readline = createInterface({input: process.stdin, output: process.stderr})

  try {
    const answer = await readline.question(`Continue scanning ignored path ${rootDir}? [y/N] `)
    return /^(?:y|yes)$/i.test(answer.trim())
  } finally {
    readline.close()
  }
}
