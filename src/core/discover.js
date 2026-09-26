/**
 * Skill discovery utilities
 */

import fs from 'fs/promises'
import path from 'path'
import ignore from 'ignore'
import {fileExists, hasExactEntry} from './fsx.js'

const SKILL_FILENAME = 'skill.md'
const GITIGNORE_FILENAME = '.gitignore'

export async function discoverSkills(rootDir, options = {}) {
  const resolvedRoot = path.resolve(rootDir)
  const rootStatus = options.rootStatus || (await inspectDiscoveryRoot(resolvedRoot))

  if (rootStatus.ignored && !options.allowIgnoredRoot) {
    return []
  }

  const results = new Set()
  const initialScopes = rootStatus.ignored ? [] : rootStatus.scopes

  async function traverse(currentDir, parentScopes) {
    const entries = await fs.readdir(currentDir, {withFileTypes: true})

    if (entries.some(entry => entry.name.toLowerCase() === SKILL_FILENAME)) {
      results.add(currentDir)
    }

    const scopes = await addIgnoreScope(currentDir, entries, parentScopes)
    const directories = entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of directories) {
      const childDir = path.join(currentDir, entry.name)
      if (isIgnored(childDir, scopes, true)) continue
      await traverse(childDir, scopes)
    }
  }

  await traverse(resolvedRoot, initialScopes)
  return Array.from(results).sort()
}

export async function inspectDiscoveryRoot(rootDir) {
  const resolvedRoot = path.resolve(rootDir)
  const repositoryRoot = await findRepositoryRoot(resolvedRoot)
  const pathChain = relativeDirectoryChain(repositoryRoot, resolvedRoot)
  let currentDir = repositoryRoot
  let scopes = []

  for (const childDir of pathChain) {
    const entries = await fs.readdir(currentDir, {withFileTypes: true})
    scopes = await addIgnoreScope(currentDir, entries, scopes)

    if (isIgnored(childDir, scopes, true)) {
      return {ignored: true, repositoryRoot, scopes}
    }

    currentDir = childDir
  }

  return {ignored: false, repositoryRoot, scopes}
}

async function findRepositoryRoot(startDir) {
  let currentDir = startDir

  while (true) {
    if (await hasExactEntry(currentDir, '.git')) {
      return currentDir
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) return startDir
    currentDir = parentDir
  }
}

function relativeDirectoryChain(baseDir, targetDir) {
  const relative = path.relative(baseDir, targetDir)
  if (!relative) return []
  return relative.split(path.sep).reduce((chain, segment) => {
    chain.push(path.join(chain.at(-1) || baseDir, segment))
    return chain
  }, [])
}

async function addIgnoreScope(dirPath, entries, scopes) {
  if (!entries.some(entry => entry.name === GITIGNORE_FILENAME && !entry.isDirectory())) {
    return scopes
  }

  const contents = await fs.readFile(path.join(dirPath, GITIGNORE_FILENAME), 'utf8')
  return [...scopes, {baseDir: dirPath, matcher: ignore().add(contents)}]
}

function isIgnored(targetPath, scopes, directory = false) {
  let ignored = false

  for (const scope of scopes) {
    const relativePath = path.relative(scope.baseDir, targetPath)
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) continue

    const normalizedPath = relativePath.split(path.sep).join('/') + (directory ? '/' : '')
    const result = scope.matcher.test(normalizedPath)
    if (result.ignored) ignored = true
    if (result.unignored) ignored = false
  }

  return ignored
}

export async function resolveSkillPaths(inputs, baseDir = '.') {
  const results = new Set()

  for (const input of inputs) {
    const resolved = path.resolve(baseDir, input)

    try {
      const stat = await fs.stat(resolved)

      if (stat.isDirectory()) {
        // Keep directories even when SKILL.md is missing so validation can report
        // the missing file rather than silently skipping the target.
        results.add(resolved)
      } else if (path.basename(input).toLowerCase() === SKILL_FILENAME) {
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
