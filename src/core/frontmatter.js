/**
 * YAML frontmatter parsing
 */

export function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/m)
  if (!match) {
    return null
  }

  const frontmatter = {}
  const lines = match[1].split('\n')
  let currentKey = null
  let currentValue = ''

  for (const line of lines) {
    const separatorIndex = line.indexOf(':')
    const key = separatorIndex > 0 ? line.slice(0, separatorIndex) : null

    if (key !== null && /^\w+$/.test(key) && !line.startsWith(' ')) {
      if (currentKey) {
        frontmatter[currentKey] = currentValue.trim().replace(/^["']|["']$/g, '')
      }
      currentKey = key
      currentValue = line.slice(separatorIndex + 1)
    } else if (currentKey) {
      currentValue += ' ' + line.trim()
    }
  }

  if (currentKey) {
    frontmatter[currentKey] = currentValue.trim().replace(/^["']|["']$/g, '')
  }

  return frontmatter
}
