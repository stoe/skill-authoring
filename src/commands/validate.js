/**
 * Validate command - checks skill structure and content
 */

import path from 'path'
import {discoverSkills, resolveSkillPaths} from '../core/discover.js'
import {validateSkill} from '../validate/index.js'
import {createReporter, reportBatch} from '../core/reporters.js'

export async function validateCommand(args = {}) {
  const {skill, all = false, rootDir, format = 'pretty', failLevel = 'error'} = args

  if (!['error', 'warning'].includes(failLevel)) {
    throw new Error(`Invalid fail level: ${failLevel}. Expected 'error' or 'warning'.`)
  }

  const reporter = createReporter(format)
  const results = []

  let skillPaths = []

  if (all) {
    const resolvedRoot = path.resolve(rootDir || '.')
    skillPaths = await discoverSkills(resolvedRoot)
  } else if (skill) {
    skillPaths = await resolveSkillPaths([skill])
  } else {
    // Default: validate all in current workspace
    const resolvedRoot = path.resolve(rootDir || '.')
    skillPaths = await discoverSkills(resolvedRoot)
  }

  for (const skillPath of skillPaths) {
    const result = await validateSkill(skillPath)
    results.push(result)

    if (format === 'pretty') {
      reporter(result)
    }
  }

  // Report batch summary
  const exitCode = reportBatch(results, format, failLevel)
  return exitCode
}
