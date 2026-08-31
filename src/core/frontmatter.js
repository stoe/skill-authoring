/**
 * YAML frontmatter parsing
 */

export function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/m)
  if (!match) {
    return null
  }

  const frontmatter = {}
  const lines = match[1].split('\n')
  let currentKey = null
  let currentValue = ''

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/)
    if (keyMatch && !line.startsWith(' ')) {
      if (currentKey) {
        frontmatter[currentKey] = currentValue.trim().replace(/^["']|["']$/g, '')
      }
      currentKey = keyMatch[1]
      currentValue = keyMatch[2]
    } else if (currentKey) {
      currentValue += ' ' + line.trim()
    }
  }

  if (currentKey) {
    frontmatter[currentKey] = currentValue.trim().replace(/^["']|["']$/g, '')
  }

  return frontmatter
}
