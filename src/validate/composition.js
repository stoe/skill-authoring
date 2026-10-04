/**
 * Repository-scoped composition validation and exact reviewed findings.
 */

import crypto from 'node:crypto'
import {execFile} from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import {promisify} from 'node:util'

const REVIEWED_FINDINGS_VERSION = 1
const DISPOSITION_ELIGIBLE_RULES = new Set(['security.instruction-override'])
const REVIEW_TYPES = new Set(['self-declared', 'independently-reviewed'])
const execFileAsync = promisify(execFile)

export async function createCompositionPolicy(skillDir, {fallbackRoot = skillDir, reviewedFindingsPath} = {}) {
  const lexicalSkillDir = path.resolve(skillDir)
  const repositoryRoot = await findRepositoryRoot(lexicalSkillDir)
  const requestedBoundaryRoot = path.resolve(repositoryRoot || fallbackRoot)
  const realBoundaryRoot = await fs.realpath(requestedBoundaryRoot)
  const realSkillDir = await fs.realpath(lexicalSkillDir)
  if (!isPathInside(realBoundaryRoot, realSkillDir)) {
    throw new Error(`Skill directory must remain inside the validation root: ${skillDir}`)
  }
  const lexicalBoundaryRoot = repositoryRoot
    ? path.resolve(lexicalSkillDir, path.relative(realSkillDir, realBoundaryRoot))
    : requestedBoundaryRoot
  if (reviewedFindingsPath && !repositoryRoot) {
    throw new Error(`Reviewed findings require a Git repository: ${skillDir}`)
  }

  const exceptions = reviewedFindingsPath ? await readReviewedFindings(reviewedFindingsPath, realBoundaryRoot) : []

  return {
    boundaryRoot: realBoundaryRoot,
    lexicalBoundaryRoot,
    reviewedFindingsEnabled: Boolean(reviewedFindingsPath),
    exceptions,
  }
}

export function isPathInside(root, target) {
  const relative = path.relative(root, target)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

export function repositoryRelativePath(root, target) {
  return path.relative(root, target).split(path.sep).join('/')
}

export function fingerprintSourceLine(line) {
  return `sha256:${crypto.createHash('sha256').update(line, 'utf8').digest('hex')}`
}

export async function applyReviewedDispositions(results, policy) {
  if (!policy) return []

  const matched = new Set()
  for (const result of results) {
    for (const issue of result.errors) {
      if (!issue.dispositionEligible || !issue.line || !issue.fingerprint) continue

      const issuePath = await fs.realpath(path.resolve(result.skillPath, issue.path))
      const relativePath = repositoryRelativePath(policy.boundaryRoot, issuePath)
      const exception = policy.exceptions.find(
        candidate => candidate.rule === issue.code && candidate.path === relativePath && candidate.line === issue.line,
      )
      if (!exception || exception.fingerprint !== issue.fingerprint) continue

      issue.reviewedDisposition = {
        reviewType: exception.reviewType,
        rationale: exception.rationale,
        fingerprint: exception.fingerprint,
      }
      matched.add(exception)
    }
  }

  const unmatched = []
  for (const exception of policy.exceptions) {
    if (matched.has(exception)) continue

    let stale = false
    try {
      const sourcePath = path.resolve(policy.boundaryRoot, exception.path)
      if (!isPathInside(policy.boundaryRoot, sourcePath)) {
        throw new Error(`Reviewed finding path escapes the validation boundary: ${exception.path}`)
      }
      const realSourcePath = await fs.realpath(sourcePath)
      if (!isPathInside(policy.boundaryRoot, realSourcePath)) {
        throw new Error(`Reviewed finding source resolves outside the validation boundary: ${exception.path}`)
      }
      const source = await fs.readFile(realSourcePath, 'utf8')
      const currentLine = source.split(/\r?\n/)[exception.line - 1]
      stale = currentLine === undefined || fingerprintSourceLine(currentLine) !== exception.fingerprint
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      stale = true
    }

    const relativeDirectory = await findContainingSkillDirectory(results, policy.boundaryRoot, exception.path)
    unmatched.push({
      code: stale ? 'security.review-exception.stale' : 'security.review-exception.unmatched',
      message: stale
        ? `Reviewed finding fingerprint is stale for ${exception.path}:${exception.line}; re-review the changed source`
        : `Reviewed finding exception did not match a finding: ${exception.path}:${exception.line}; remove or update it`,
      path: exception.path,
      targetSkillPath: relativeDirectory,
    })
  }

  return unmatched
}

async function findContainingSkillDirectory(results, repositoryRoot, sourcePath) {
  for (const result of results) {
    const realSkillDir = await fs.realpath(result.skillPath)
    const relativeSkillDir = repositoryRelativePath(repositoryRoot, realSkillDir)
    if (sourcePath.startsWith(`${relativeSkillDir}/`)) return result.skillPath
  }
  return null
}

async function findRepositoryRoot(startDir) {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))

  try {
    const {stdout} = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {cwd: startDir, env: environment})
    return stdout.trim()
  } catch (error) {
    if (error.code === 128 && /not a git repository/i.test(error.stderr || '')) return null
    throw new Error(`Failed to determine Git repository root from ${startDir}: ${error.message}`)
  }
}

async function readReviewedFindings(inputPath, repositoryRoot) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new Error('Reviewed findings path must be a non-empty path')
  }

  const requestedPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(repositoryRoot, inputPath)
  if (!path.isAbsolute(inputPath) && !isPathInside(repositoryRoot, requestedPath)) {
    throw new Error(`Reviewed findings file must remain inside the repository: ${inputPath}`)
  }

  const realPath = await fs.realpath(requestedPath)
  if (!isPathInside(repositoryRoot, realPath)) {
    throw new Error(`Reviewed findings file must remain inside the repository: ${inputPath}`)
  }
  if (!(await fs.stat(realPath)).isFile()) {
    throw new Error(`Reviewed findings path must be a file: ${inputPath}`)
  }

  let document
  try {
    document = JSON.parse(await fs.readFile(realPath, 'utf8'))
  } catch (error) {
    throw new Error(`Failed to parse reviewed findings file ${inputPath}: ${error.message}`)
  }
  if (document?.version !== REVIEWED_FINDINGS_VERSION || !Array.isArray(document.exceptions)) {
    throw new Error(
      `Reviewed findings file must use version ${REVIEWED_FINDINGS_VERSION} and contain an exceptions array`,
    )
  }

  const seenLocations = new Set()
  return document.exceptions.map((exception, index) => {
    const record = validateException(exception, index)
    const location = `${record.rule}\0${record.path}\0${record.line}`
    if (seenLocations.has(location)) {
      throw new Error(`Duplicate reviewed finding location at exception ${index + 1}: ${record.path}:${record.line}`)
    }
    seenLocations.add(location)
    return record
  })
}

function validateException(exception, index) {
  const recordNumber = index + 1
  const expectedKeys = ['rule', 'path', 'line', 'fingerprint', 'reviewType', 'rationale']

  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) {
    throw new Error(`Reviewed finding exception ${recordNumber} must be an object`)
  }
  if (Object.keys(exception).some(key => !expectedKeys.includes(key))) {
    throw new Error(`Reviewed finding exception ${recordNumber} contains an unsupported field`)
  }
  if (!DISPOSITION_ELIGIBLE_RULES.has(exception.rule)) {
    throw new Error(`Reviewed finding exception ${recordNumber} uses an unsupported rule: ${exception.rule}`)
  }
  if (
    typeof exception.path !== 'string' ||
    exception.path.startsWith('/') ||
    exception.path.includes('\\') ||
    exception.path.split('/').some(segment => !segment || segment === '.' || segment === '..') ||
    path.posix.normalize(exception.path) !== exception.path
  ) {
    throw new Error(`Reviewed finding exception ${recordNumber} must use a normalized repository-relative path`)
  }
  if (!Number.isSafeInteger(exception.line) || exception.line < 1) {
    throw new Error(`Reviewed finding exception ${recordNumber} must include a positive line number`)
  }
  if (typeof exception.fingerprint !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(exception.fingerprint)) {
    throw new Error(`Reviewed finding exception ${recordNumber} must include a SHA-256 source fingerprint`)
  }
  if (!REVIEW_TYPES.has(exception.reviewType)) {
    throw new Error(`Reviewed finding exception ${recordNumber} must declare self-declared or independently-reviewed`)
  }
  if (typeof exception.rationale !== 'string' || !exception.rationale.trim()) {
    throw new Error(`Reviewed finding exception ${recordNumber} must include a review rationale`)
  }

  return {
    rule: exception.rule,
    path: exception.path,
    line: exception.line,
    fingerprint: exception.fingerprint,
    reviewType: exception.reviewType,
    rationale: exception.rationale.trim(),
  }
}
