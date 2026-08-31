/**
 * Micro-template validators for skill descriptions
 */

function normalizeText(text) {
  return (text || '').replace(/[\t\r\n]+/g, ' ').trim()
}

function hasTriggerContext(text) {
  const t = (text || '').trim()
  const patterns = [
    /\buse\s+when\b/i,
    /\buse\s+if\b/i,
    /\bwhen\s+to\s+use\b/i,
    /\bideal\s+for\b/i,
    /\bbest\s+for\b/i,
    /\bgood\s+for\b/i,
    /\brecommended\s+when\b/i,
    /\bsuited\s+for\b/i,
    /\bbuilt\s+for\b/i,
    /\bnutzen\s+bei\b/i,
    /\bverwenden\s+bei\b/i,
    /\bverwenden[,\s]+wenn\b/i,
    /\bnutze\s+wenn\b/i,
    /\bverwende\s+wenn\b/i,
    /\bgeeignet\s+für\b/i,
    /\bideal\s+für\b/i,
    /\bam\s+besten\s+wenn\b/i,
  ]
  return patterns.some(re => re.test(t))
}

function checkIOTokens(text) {
  const errors = []
  if (/\bOutput:\b/i.test(text)) {
    errors.push('contains disallowed token "Output:"')
  }
  return errors
}

function hasNoLinks(text) {
  return !/(https?:\/\/|\[[^\]]+\]\([^\)]+\))/i.test(text)
}

export function validateMicroTemplate(description) {
  const desc = normalizeText(description)
  const issues = []

  if (desc.length > 1024) {
    issues.push({
      severity: 'error',
      code: 'desc.toolong',
      message: `Description exceeds 1024 characters (${desc.length} chars)`,
    })
  }

  if (/^(I |You |This skill |Creates |Helps you)/i.test(desc)) {
    issues.push({
      severity: 'error',
      code: 'desc.person',
      message: "Description should use third person ('Provides...Use when...' not 'I/You/Creates/Helps')",
    })
  }

  // Trigger context (flexible, not required to start the description)
  if (!hasTriggerContext(desc)) {
    issues.push({
      severity: 'warn',
      code: 'desc.trigger',
      message: "Description should include trigger context (e.g., 'Use when…' or 'Nutzen bei…').",
    })
  }

  // Boundary/Grenze checks removed per policy update

  // I/O tokens
  const ioErrors = checkIOTokens(desc)
  ioErrors.forEach(m => {
    issues.push({
      severity: 'error',
      code: 'desc.io',
      message: m,
    })
  })

  // No links
  if (!hasNoLinks(desc)) {
    issues.push({
      severity: 'error',
      code: 'desc.links',
      message: 'Description must not contain URLs or Markdown links.',
    })
  }

  if (/<[a-zA-Z][^>]*>/.test(desc)) {
    issues.push({
      severity: 'error',
      code: 'desc.xml',
      message: 'Description contains XML tags (not allowed)',
    })
  }

  // Control characters
  if (/[\u0000-\u001F\u007F]/.test(desc)) {
    issues.push({
      severity: 'error',
      code: 'desc.ctrl',
      message: 'Description contains control characters.',
    })
  }

  // NBSP
  if (/\u00A0/.test(description)) {
    issues.push({
      severity: 'warn',
      code: 'desc.nbsp',
      message: 'Description contains NBSP (non-breaking space). Consider replacing.',
    })
  }

  // Double spaces
  if (/ {2,}/.test(desc)) {
    issues.push({
      severity: 'warn',
      code: 'desc.doublespace',
      message: 'Description contains double spaces.',
    })
  }

  // Trailing whitespace
  if (/[ \t]+$/.test(description)) {
    issues.push({
      severity: 'warn',
      code: 'desc.trailing',
      message: 'Description has trailing whitespace.',
    })
  }

  return issues
}
