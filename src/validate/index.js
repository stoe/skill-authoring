/**
 * Main skill validation orchestrator
 */

import fs from 'fs/promises'
import path from 'path'
import {readText, walk, fileExists, listDir} from '../core/fsx.js'
import {extractFrontmatter} from '../core/frontmatter.js'
import {validateMicroTemplate} from './micro-templates.js'
import {
  checkInvisibleUnicode,
  checkEncodedPayloads,
  checkInstructionOverridePatterns,
  checkHardcodedLocalPaths,
  checkReferencePathSafety,
  checkExternalUrlUntrusted,
  checkBoundaryLanguage,
  checkSecurityMetadataGuidance,
  checkProfilePolicy,
} from './security.js'

export async function validateSkill(skillDir, {profile = 'standard'} = {}) {
  const skillName = path.basename(skillDir)
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  const skillMdIssuePath = 'SKILL.md'

  const errors = []
  const warnings = []
  const infos = []

  // Check SKILL.md exists
  if (!(await fileExists(skillMdPath))) {
    errors.push({code: 'skill.missing', message: 'SKILL.md not found', path: skillMdIssuePath})
    return {skillName, errors, warnings, infos}
  }

  // Read and parse frontmatter
  let content
  try {
    const data = await readText(skillMdPath)
    content = data.text
  } catch (err) {
    errors.push({
      code: 'skill.read',
      message: `Failed to read SKILL.md: ${err.message}`,
      path: skillMdIssuePath,
    })
    return {skillName, errors, warnings, infos}
  }

  const frontmatter = extractFrontmatter(content)
  if (!frontmatter) {
    errors.push({
      code: 'skill.frontmatter',
      message: 'No YAML frontmatter found in SKILL.md',
      path: skillMdIssuePath,
    })
    return {skillName, errors, warnings, infos}
  }

  // Validate name
  validateName(frontmatter.name, skillDir, errors, warnings, skillMdIssuePath)

  // Validate required description field
  if (!frontmatter.description) {
    errors.push({
      code: 'desc.missing',
      message: 'Missing required field: description',
      path: skillMdIssuePath,
    })
  }

  // Validate micro-template
  if (frontmatter.description) {
    const mtIssues = validateMicroTemplate(frontmatter.description)
    mtIssues.forEach(issue => {
      const issueWithPath = {...issue, path: skillMdIssuePath}
      if (issue.severity === 'error') errors.push(issueWithPath)
      else warnings.push(issueWithPath)
    })
  }

  // Check SKILL.md length (words, excluding frontmatter)
  const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/m)
  const skillContent = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content
  const wordCount = skillContent
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length
  const lineCount = skillContent.split('\n').length

  if (wordCount > 5000) {
    errors.push({
      code: 'skill.words',
      message: `SKILL.md exceeds 5000 words (${wordCount} words; push details to references/)`,
      path: skillMdIssuePath,
    })
  }

  if (lineCount > 120) {
    warnings.push({
      code: 'skill.lines',
      message: `SKILL.md has ${lineCount} lines (target ~100 lines; max 120 with 20% buffer for leanness)`,
      path: skillMdIssuePath,
    })
  }

  // Check nested references
  await checkNestedReferences(skillDir, warnings)

  // Check reference TOCs
  await checkReferenceTOCs(skillDir, infos, warnings)

  // Check broken links
  await checkBrokenLinks(skillDir, warnings)

  // Check extraneous files
  await checkExtraneousFiles(skillDir, errors, warnings)

  // Check placeholder text
  await checkPlaceholderText(skillDir, warnings)

  // Check heading hierarchy
  await checkHeadingHierarchy(skillDir, warnings)

  // Check duplicate headings
  await checkDuplicateHeadings(skillDir, warnings)

  // Check poor link text
  await checkPoorLinkText(skillDir, warnings)

  // Check boundary/"must not" language in the description
  checkBoundaryLanguage(frontmatter.description, warnings, skillMdIssuePath)

  // Security checks (OWASP Agentic Skills Top 10)
  await checkInvisibleUnicode(skillDir, errors)
  await checkInstructionOverridePatterns(skillDir, errors)
  await checkEncodedPayloads(skillDir, warnings)
  await checkHardcodedLocalPaths(skillDir, profile === 'public' ? errors : warnings)
  await checkReferencePathSafety(skillDir, errors, warnings)
  await checkExternalUrlUntrusted(skillDir, warnings)
  await checkSecurityMetadataGuidance(skillDir, frontmatterMatch ? frontmatterMatch[0] : '', warnings)
  await checkProfilePolicy(skillDir, profile, errors)

  return {skillName, profile, errors, warnings, infos}
}

function validateName(name, skillDir, errors, warnings, issuePath) {
  if (!name) {
    errors.push({code: 'name.missing', message: 'Missing required field: name', path: issuePath})
    return
  }

  if (!/^[a-z0-9-]+$/.test(name)) {
    errors.push({
      code: 'name.format',
      message: 'Name must contain only lowercase letters, numbers, and hyphens',
      path: issuePath,
    })
  }

  if (/^-|-$/.test(name)) {
    errors.push({
      code: 'name.edges',
      message: 'Name must not start or end with a hyphen',
      path: issuePath,
    })
  }

  if (/--/.test(name)) {
    errors.push({
      code: 'name.consec',
      message: 'Name must not contain consecutive hyphens',
      path: issuePath,
    })
  }

  const dirName = path.basename(skillDir)
  if (dirName !== name) {
    errors.push({
      code: 'name.match',
      message: `Name '${name}' must match directory '${dirName}' (spec requirement)`,
      path: issuePath,
    })
  }

  if (name.length > 64) {
    errors.push({
      code: 'name.length',
      message: `Name exceeds 64 characters (${name.length} chars)`,
      path: issuePath,
    })
  }

  if (/(anthropic|claude)/.test(name)) {
    errors.push({
      code: 'name.reserved',
      message: 'Name contains reserved words: anthropic or claude',
      path: issuePath,
    })
  }

  if (/(helper|tool|utils|misc)/.test(name)) {
    warnings.push({
      code: 'name.vague',
      message: `Name contains vague term: ${name} (consider more specific name)`,
      path: issuePath,
    })
  }
}

async function checkNestedReferences(skillDir, warnings) {
  const referencesDir = path.join(skillDir, 'references')
  if (!(await fileExists(referencesDir))) return

  const files = await walk(referencesDir, {patterns: ['.md']})

  for (const file of files) {
    const data = await readText(file.path)
    if (/\]\(references\//.test(data.text)) {
      warnings.push({
        code: 'ref.nested',
        message: `Reference file ${file.name} links to other references (keep one level deep)`,
        path: path.relative(skillDir, file.path),
      })
    }
  }
}

async function checkReferenceTOCs(skillDir, infos, warnings) {
  const dirs = ['references', 'workflows', 'frameworks']

  for (const dir of dirs) {
    const dirPath = path.join(skillDir, dir)
    if (!(await fileExists(dirPath))) continue

    const files = await walk(dirPath, {patterns: ['.md']})

    for (const file of files) {
      const data = await readText(file.path)
      const lineCount = data.text.split('\n').length

      if (/<!--\s*IGNORE\s+TABLE\s+OF\s+CONTENTS\s*-->/i.test(data.text)) {
        infos.push({
          code: 'ref.toc.ignored',
          message: `Skipping TOC check for ${file.name} (explicit ignore)`,
          path: path.relative(skillDir, file.path),
        })
        continue
      }

      if (lineCount > 100) {
        if (!/Table of Contents/i.test(data.text) && !/Inhaltsverzeichnis/i.test(data.text)) {
          warnings.push({
            code: 'ref.toc.missing',
            message: `${file.name} has ${lineCount} lines but no TOC (recommend TOC for >100 lines)`,
            path: path.relative(skillDir, file.path),
          })
        }
      }
    }
  }
}

async function checkBrokenLinks(skillDir, warnings) {
  const dirs = ['references', 'workflows', 'frameworks', 'assets']
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

  for (const file of files) {
    const data = await readText(file)

    // Strip fenced code blocks (ignore links/files inside ``` ... ```)
    const stripped = (() => {
      const lines = data.text.split('\n')
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
    })()

    let match
    while ((match = linkRegex.exec(stripped)) !== null) {
      const linkTarget = match[1]
      // Allow known placeholder targets used during drafting
      if (/^url$/i.test(linkTarget)) continue

      // Skip external links and mailto
      if (/^https?:\/\//i.test(linkTarget) || /^mailto:/i.test(linkTarget)) continue

      const resolved = path.resolve(path.dirname(file), linkTarget)
      if (!(await fileExists(resolved))) {
        warnings.push({
          code: 'link.broken',
          message: `${path.basename(file)} references missing file: ${linkTarget}`,
          path: path.relative(skillDir, file),
        })
      }
    }
  }
}

async function checkExtraneousFiles(skillDir, errors, warnings) {
  const extraneousFiles = ['README.md', 'INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md', 'CHANGELOG.md']
  const junkFiles = ['.DS_Store', 'Thumbs.db']

  for (const file of extraneousFiles) {
    const filePath = path.join(skillDir, file)
    if (await fileExists(filePath)) {
      errors.push({
        code: 'file.extraneous',
        message: `Extraneous file found: ${file} (should only contain files for AI)`,
        path: file,
      })
    }
  }

  try {
    const entries = await listDir(skillDir)
    entries.forEach(entry => {
      if (junkFiles.includes(entry)) {
        warnings.push({
          code: 'file.junk',
          message: `Junk file found: ${entry} (remove it)`,
          path: entry,
        })
      }
    })
  } catch {
    // Ignore read errors (permission, etc.)
  }
}

async function checkPlaceholderText(skillDir, warnings) {
  const dirs = ['references', 'workflows', 'frameworks']
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

  const placeholderRegex =
    /\b(?:TODO|FIXME|TBD|XXX|HACK|NOTE TO SELF)\b|\[insert[^\]]*\]|\[your[^\]]*\]|\[placeholder\]/gi

  for (const file of files) {
    const data = await readText(file)
    const lines = data.text.split('\n')

    // Build line-level ignore map for YAML frontmatter tools list entries.
    const frontmatterToolLines = new Set()
    let inFrontmatter = false
    let frontmatterDelimiters = 0
    let inToolsList = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed === '---' && i < 80) {
        frontmatterDelimiters += 1
        if (frontmatterDelimiters === 1) {
          inFrontmatter = true
          continue
        }
        if (frontmatterDelimiters === 2) {
          inFrontmatter = false
          inToolsList = false
          break
        }
      }

      if (!inFrontmatter) continue

      if (!inToolsList && /^\s*tools\s*:/.test(line)) {
        inToolsList = true
      }

      if (inToolsList) {
        frontmatterToolLines.add(i)

        if (trimmed.includes(']')) {
          inToolsList = false
          continue
        }

        // End tools block when another top-level key starts.
        if (
          !line.startsWith(' ') &&
          !line.startsWith('\t') &&
          /^[a-zA-Z0-9_-]+\s*:/.test(line) &&
          !/^\s*tools\s*:/.test(line)
        ) {
          inToolsList = false
        }
      }
    }

    // Build ignore regions: line numbers to skip
    const ignoreLines = new Set()
    let inIgnoreBlock = false
    let inFencedCode = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip fenced code blocks (``` ... ```); the fence lines are ignored too.
      if (/^```/.test(line)) {
        ignoreLines.add(i)
        inFencedCode = !inFencedCode
        continue
      }
      if (inFencedCode) {
        ignoreLines.add(i)
        continue
      }

      // Check for block start/stop
      if (/<!--\s*validation\s+ignore\s+start\s*-->/i.test(line)) {
        inIgnoreBlock = true
      }
      if (/<!--\s*validation\s+ignore\s+stop\s*-->/i.test(line)) {
        inIgnoreBlock = false
      }

      // Mark line as ignored if in block or has inline ignore
      if (inIgnoreBlock || /<!--\s*validation\s+ignore\s*-->/i.test(line)) {
        ignoreLines.add(i)
      }
    }

    // Find placeholders, excluding ignored lines
    const foundPlaceholders = []
    for (let i = 0; i < lines.length; i++) {
      if (ignoreLines.has(i)) continue

      const line = lines[i]
      const lineMatches = [...line.matchAll(placeholderRegex)]
      const backtickSpans = []
      let inInlineCode = false
      let spanStart = -1
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '`') {
          if (!inInlineCode) {
            inInlineCode = true
            spanStart = c
          } else {
            backtickSpans.push([spanStart, c])
            inInlineCode = false
            spanStart = -1
          }
        }
      }
      if (lineMatches.length > 0) {
        for (const match of lineMatches) {
          const matched = match[0]
          const start = match.index ?? -1
          const end = start + matched.length
          // Ignore any placeholder inside an inline code span (`...`).
          const isInBackticks = backtickSpans.some(([s, e]) => start > s && end <= e)
          if (isInBackticks) continue
          foundPlaceholders.push({matched, lineIndex: i})
        }
      }
    }

    // Ignore TODO placeholder hits only when they come from frontmatter tools list entries.
    const filtered = foundPlaceholders.filter(({matched, lineIndex}) => {
      if (matched.toLowerCase() !== 'todo') return true
      return !frontmatterToolLines.has(lineIndex)
    })

    if (filtered.length > 0) {
      warnings.push({
        code: 'text.placeholder',
        message: `${path.basename(file)} contains placeholder text: ${filtered
          .slice(0, 3)
          .map(({matched}) => matched)
          .join(', ')}${filtered.length > 3 ? '...' : ''}`,
        path: path.relative(skillDir, file),
      })
    }
  }
}

async function checkHeadingHierarchy(skillDir, warnings) {
  const dirs = ['references', 'workflows', 'frameworks']
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

  for (const file of files) {
    const data = await readText(file)
    const lines = data.text.split('\n')
    let previousLevel = 0
    let inCodeBlock = false

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^```/)) {
        inCodeBlock = !inCodeBlock
        continue
      }

      if (inCodeBlock) continue

      const headingMatch = lines[i].match(/^(#{1,6})[ \t]+\S/)
      if (headingMatch) {
        const currentLevel = headingMatch[1].length
        if (previousLevel > 0 && currentLevel > previousLevel + 1) {
          warnings.push({
            code: 'heading.jump',
            message: `${path.basename(file)} line ${i + 1}: heading jumps from H${previousLevel} to H${currentLevel} (skips levels)`,
            path: path.relative(skillDir, file),
          })
        }
        previousLevel = currentLevel
      }
    }
  }
}

async function checkDuplicateHeadings(skillDir, warnings) {
  const dirs = ['references', 'workflows', 'frameworks']
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

  for (const file of files) {
    const data = await readText(file)
    const headings = []
    const lines = data.text.split('\n')

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}[ \t]+(.+)$/)
      if (headingMatch) {
        const headingText = headingMatch[1].trim()
        if (headings.includes(headingText)) {
          warnings.push({
            code: 'heading.dup',
            message: `${path.basename(file)} has duplicate heading: "${headingText}" (may confuse anchor links)`,
            path: path.relative(skillDir, file),
          })
        }
        headings.push(headingText)
      }
    }
  }
}

async function checkPoorLinkText(skillDir, warnings) {
  const dirs = ['references', 'workflows', 'frameworks']
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

  const poorLinkRegex = /\[(here|click here|this|link|read more)\]\(/gi

  for (const file of files) {
    const data = await readText(file)
    const matches = data.text.match(poorLinkRegex)

    if (matches) {
      warnings.push({
        code: 'link.poor',
        message: `${path.basename(file)} has generic link text: ${matches.slice(0, 2).join(', ')}${matches.length > 2 ? '...' : ''} (use descriptive text)`,
        path: path.relative(skillDir, file),
      })
    }
  }
}
