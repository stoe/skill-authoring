/**
 * Skill discovery utilities
 */

import fs from 'fs/promises'
import path from 'path'
import {walk, fileExists} from './fsx.js'

export async function discoverSkills(rootDir) {
  const results = []
  const entries = await fs.readdir(rootDir, {withFileTypes: true})

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = path.join(rootDir, entry.name)
    const skillMdPath = path.join(skillDir, 'SKILL.md')

    if (await fileExists(skillMdPath)) {
      results.push(skillDir)
    }
  }

  return results.sort()
}

export async function resolveSkillPaths(inputs, baseDir = '.') {
  const results = new Set()

  for (const input of inputs) {
    const resolved = path.resolve(baseDir, input)

    try {
      const stat = await fs.stat(resolved)

      if (stat.isDirectory()) {
        // Single skill directory
        const skillMdPath = path.join(resolved, 'SKILL.md')
        if (await fileExists(skillMdPath)) {
          results.add(resolved)
        }
      } else if (input.endsWith('SKILL.md')) {
        // Single SKILL.md file
        const skillDir = path.dirname(resolved)
        results.add(skillDir)
      }
    } catch {
      // Silently skip missing files
    }
  }

  return Array.from(results).sort()
}
