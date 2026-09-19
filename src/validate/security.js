/**
 * Security-focused validators for skill content.
 *
 * These checks target OWASP Agentic Skills Top 10 risks such as malicious
 * skill content (AST01), insecure metadata (AST04), weak isolation (AST06),
 * and poor scanning (AST08). They inspect SKILL.md plus references/,
 * workflows/, and frameworks/ Markdown files.
 */

import path from 'path'
import {readText, fileExists, walk} from '../core/fsx.js'

const DOC_DIRS = ['references', 'workflows', 'frameworks']

// Zero-width, bidi-override, and other invisible/format Unicode code points
// that can hide text from human reviewers or alter rendered reading order.
const INVISIBLE_UNICODE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u00AD]/

// Long unbroken base64-like runs are suspicious inside instruction docs;
// short tokens (hashes, IDs) are common and ignored via the length floor.
const BASE64_BLOB_RE = /(?:[A-Za-z0-9+/]{80,}={0,2})/

// Phrases commonly used to hijack an agent's instructions ("prompt
// injection") when embedded in skill content the agent will read.
const INSTRUCTION_OVERRIDE_PATTERNS = [
  /\bignore (all|any|the)? ?(previous|prior|above|earlier) instructions\b/i,
  /\bdisregard (all|any)? ?(previous|prior|above|earlier) (instructions|rules|prompts)\b/i,
  /\byou are now (in )?(developer|debug|jailbreak|dan) mode\b/i,
  /\bact as if you have no (restrictions|rules|limits)\b/i,
  /\boverride (your|the) system prompt\b/i,
  /\breveal (your|the) (system prompt|hidden instructions)\b/i,
  /\bpretend (you have|to have) no (safety|guard ?rails?)\b/i,
]

// Personal/local absolute paths that should not ship in public skill docs.
const HARDCODED_LOCAL_PATH_RE = /(\/Users\/[^/\s)`'"]+\/|\/home\/[^/\s)`'"]+\/|[A-Za-z]:\\Users\\[^\\\s)`'"]+\\)/

const PRIVATE_URL_PATTERNS = [
  /https?:\/\/(?:[^/\s]+\.)?internal(?:[/:]|$)/i,
  /https?:\/\/localhost(?:[/:]|$)/i,
  /https?:\/\/(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?:[/:]|$)/i,
  /https?:\/\/github-hr\.zendesk\.com(?:[/:]|$)/i,
  /https?:\/\/thehub\.github\.com(?:[/:]|$)/i,
]

const BOUNDARY_PATTERN_RE = /\b(boundary|not for|do not use for|out of scope|must not be used|should not be used)\b/i

async function collectDocFiles(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  const files = []

  if (await fileExists(skillMdPath)) files.push(skillMdPath)

  for (const dir of DOC_DIRS) {
    const dirPath = path.join(skillDir, dir)
    if (await fileExists(dirPath)) {
      const found = await walk(dirPath, {patterns: ['.md']})
      files.push(...found.map(f => f.path))
    }
  }

  return files
}

/** Strip fenced code blocks so examples of "bad" text don't self-trigger. */
function stripFencedCode(text) {
  const lines = text.split('\n')
  let inCode = false
  const out = []
  for (const line of lines) {
    if (/^```/.test(line)) {
      inCode = !inCode
      continue
    }
    if (!inCode) out.push(line)
  }
  return out.join('\n')
}

export async function checkInvisibleUnicode(skillDir, errors) {
  const files = await collectDocFiles(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const match = data.text.match(INVISIBLE_UNICODE_RE)
    if (match) {
      const codePoint = `U+${match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
      errors.push({
        code: 'security.invisible-unicode',
        message: `${path.basename(file)} contains an invisible/format Unicode character (${codePoint}); remove it before sharing`,
      })
    }
  }
}

export async function checkEncodedPayloads(skillDir, warnings) {
  const files = await collectDocFiles(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)
    if (BASE64_BLOB_RE.test(stripped)) {
      warnings.push({
        code: 'security.encoded-payload',
        message: `${path.basename(file)} contains a long base64-like blob outside a fenced code block; verify it is not an encoded instruction payload`,
      })
    }
  }
}

export async function checkInstructionOverridePatterns(skillDir, errors) {
  const files = await collectDocFiles(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)
    for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
      if (pattern.test(stripped)) {
        errors.push({
          code: 'security.instruction-override',
          message: `${path.basename(file)} contains a suspicious instruction-override phrase (possible prompt injection): matches ${pattern}`,
        })
        break
      }
    }
  }
}

export async function checkHardcodedLocalPaths(skillDir, warnings) {
  const files = await collectDocFiles(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)
    const match = stripped.match(HARDCODED_LOCAL_PATH_RE)
    if (match) {
      warnings.push({
        code: 'security.local-path',
        message: `${path.basename(file)} contains a hardcoded personal/local path (${match[0].trim()}); remove before publishing`,
      })
    }
  }
}

export async function checkProfilePolicy(skillDir, profile, errors) {
  if (!['standard', 'public', 'private'].includes(profile)) {
    throw new Error(`Invalid validation profile: ${profile}`)
  }

  if (profile !== 'public') return

  const files = await collectDocFiles(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)
    const match = PRIVATE_URL_PATTERNS.map(pattern => stripped.match(pattern)).find(Boolean)

    if (match) {
      errors.push({
        code: 'profile.public.private-url',
        message: `${path.basename(file)} references a private or authenticated-only URL (${match[0]}); remove or replace it before public distribution`,
      })
    }
  }

  const privateMarker = path.join(skillDir, '.private')
  if (await fileExists(privateMarker)) {
    errors.push({
      code: 'profile.public.private-marker',
      message: 'Skill contains a .private marker and cannot be distributed with the public profile',
    })
  }
}

export async function checkReferencePathSafety(skillDir, errors, warnings) {
  const dirs = [...DOC_DIRS, 'assets']
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  const files = []

  if (await fileExists(skillMdPath)) files.push(skillMdPath)
  for (const dir of dirs) {
    const dirPath = path.join(skillDir, dir)
    if (await fileExists(dirPath)) {
      const found = await walk(dirPath, {patterns: ['.md']})
      files.push(...found.map(f => f.path))
    }
  }

  const linkRegex = /\[[^\]]+\]\(([^)#]+)(#[^)]+)?\)/g
  const resolvedSkillDir = path.resolve(skillDir)

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)

    let match
    while ((match = linkRegex.exec(stripped)) !== null) {
      const target = match[1]

      if (/^https?:\/\//i.test(target) || /^mailto:/i.test(target) || /^url$/i.test(target)) continue

      if (path.isAbsolute(target) || /^[A-Za-z]:\\/.test(target)) {
        errors.push({
          code: 'security.path.absolute',
          message: `${path.basename(file)} references an absolute path (${target}); use a relative path scoped to the skill directory`,
        })
        continue
      }

      const resolved = path.resolve(path.dirname(file), target)
      const relativeFromSkill = path.relative(resolvedSkillDir, resolved)
      if (relativeFromSkill.startsWith('..') || path.isAbsolute(relativeFromSkill)) {
        errors.push({
          code: 'security.path.traversal',
          message: `${path.basename(file)} references a path that escapes the skill directory (${target})`,
        })
      }
    }
  }
}

export async function checkExternalUrlUntrusted(skillDir, warnings) {
  const files = await collectDocFiles(skillDir)
  // No 'g' flag: this is a one-shot boolean test per file, not iterated with
  // exec/matchAll, so a stateful lastIndex would leak across files.
  const urlRegex = /https?:\/\/[^\s)>`'"]+/i

  let anyExternalUrl = false
  let documentsUntrusted = false
  const filesWithUrls = new Set()

  for (const file of files) {
    const data = await readText(file)
    const stripped = stripFencedCode(data.text)

    if (urlRegex.test(stripped)) {
      anyExternalUrl = true
      filesWithUrls.add(path.basename(file))
    }

    if (/untrusted/i.test(stripped)) {
      documentsUntrusted = true
    }
  }

  if (anyExternalUrl && !documentsUntrusted) {
    warnings.push({
      code: 'security.external-url',
      message: `External URL(s) referenced in ${[...filesWithUrls].join(', ')} without documenting that fetched content must be treated as untrusted data`,
    })
  }
}

export function checkBoundaryLanguage(description, warnings) {
  const text = (description || '').trim()
  if (!text) return

  if (!BOUNDARY_PATTERN_RE.test(text)) {
    warnings.push({
      code: 'security.boundary',
      message:
        'Description lacks a clear boundary/"must not" clause (e.g., \'Boundary: not for ...\'); add one so agents avoid over-triggering',
    })
  }
}

/** Detect whether a skill's scripts write files, execute shell commands, or fetch network content. */
async function detectHighRiskCapabilities(skillDir) {
  const scriptsDir = path.join(skillDir, 'scripts')
  const capabilities = {writesFiles: false, fetchesNetwork: false}

  if (!(await fileExists(scriptsDir))) return capabilities

  const scriptFiles = await walk(scriptsDir, {patterns: ['.js', '.mjs', '.cjs', '.py', '.sh']})

  for (const file of scriptFiles) {
    const data = await readText(file.path)
    if (/writeFile|writeText|fs\.write|createWriteStream/.test(data.text)) {
      capabilities.writesFiles = true
    }
    if (/fetch\(|https?\.request|axios|urlopen|curl\s|wget\s/.test(data.text)) {
      capabilities.fetchesNetwork = true
    }
  }

  return capabilities
}

export async function checkSecurityMetadataGuidance(skillDir, rawFrontmatterText, warnings) {
  const capabilities = await detectHighRiskCapabilities(skillDir)
  const isHighRisk = capabilities.writesFiles || capabilities.fetchesNetwork
  if (!isHighRisk) return

  const text = rawFrontmatterText || ''
  const recommendedFields = ['risk_tier', 'permissions', 'external_inputs', 'write_capability', 'scan_status']
  const missing = recommendedFields.filter(field => !new RegExp(`^\\s*${field}\\s*:`, 'm').test(text))

  if (missing.length > 0) {
    warnings.push({
      code: 'security.metadata.missing',
      message: `Skill has write/network capability but is missing optional security metadata: ${missing.join(', ')} (see references/core-principles.md)`,
    })
  }
}
