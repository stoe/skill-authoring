/**
 * File system utilities using Node.js built-in fs/promises
 */

import fs from 'fs/promises'
import path from 'path'

export async function readText(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8')
    const stat = await fs.stat(filePath)
    return {text, mtimeMs: stat.mtimeMs}
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err.message}`)
  }
}

export async function writeText(filePath, text) {
  try {
    await fs.mkdir(path.dirname(filePath), {recursive: true})
    await fs.writeFile(filePath, text, 'utf8')
  } catch (err) {
    throw new Error(`Failed to write ${filePath}: ${err.message}`)
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function hasExactEntry(dirPath, entryName) {
  const entries = await fs.readdir(dirPath)
  return entries.includes(entryName)
}

export async function listDir(dirPath) {
  try {
    const entries = await fs.readdir(dirPath)
    return entries
  } catch (err) {
    throw new Error(`Failed to list ${dirPath}: ${err.message}`)
  }
}

export async function walk(dir, options = {}) {
  const {patterns = [], ignore = []} = options
  const results = []

  async function traverse(current) {
    const entries = await fs.readdir(current, {withFileTypes: true})
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      const relPath = path.relative(dir, fullPath)

      // Check ignore patterns
      if (ignore.some(p => relPath.startsWith(p))) continue

      if (entry.isDirectory()) {
        await traverse(fullPath)
      } else if (patterns.length === 0 || patterns.some(p => entry.name.endsWith(p))) {
        results.push({path: fullPath, relPath, name: entry.name})
      }
    }
  }

  await traverse(dir)
  return results
}

/**
 * Resolve a skill scaffold path and verify it stays under the caller-approved
 * base directory. Prevents `outputDir` traversal segments (e.g. `../../etc`)
 * or absolute paths from writing outside the intended workspace.
 *
 * Returns `{safe: true, skillPath}` or `{safe: false, reason}`.
 */
export function resolveSafeSkillPath(baseDir, outputDir, name) {
  const resolvedBase = path.resolve(baseDir)
  const resolvedOutputDir = path.resolve(resolvedBase, outputDir)

  const outputRelToBase = path.relative(resolvedBase, resolvedOutputDir)
  if (outputRelToBase.startsWith('..') || path.isAbsolute(outputRelToBase)) {
    return {safe: false, reason: `Output directory escapes the approved base directory: ${outputDir}`}
  }

  const skillPath = path.resolve(resolvedOutputDir, name)
  const skillRelToBase = path.relative(resolvedBase, skillPath)
  if (skillRelToBase.startsWith('..') || path.isAbsolute(skillRelToBase)) {
    return {safe: false, reason: `Resolved skill path escapes the approved base directory: ${skillPath}`}
  }

  return {safe: true, skillPath}
}
