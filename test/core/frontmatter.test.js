import {describe, test} from 'node:test'
import assert from 'node:assert/strict'

import {extractFrontmatter} from '../../src/core/frontmatter.js'

describe('core/frontmatter', () => {
  test('extracts simple frontmatter fields', () => {
    const content = `---
name: demo-skill
description: Provides a sample skill. Use when validating skills.
license: MIT. See LICENSE file for details.
---

# Demo
`

    const result = extractFrontmatter(content)
    assert.deepEqual(result, {
      name: 'demo-skill',
      description: 'Provides a sample skill. Use when validating skills.',
      license: 'MIT. See LICENSE file for details.',
    })
  })

  test('returns null when no frontmatter is present', () => {
    const result = extractFrontmatter('# Demo\n\nNo frontmatter here')
    assert.equal(result, null)
  })

  test('parses frontmatter that uses CRLF line endings', () => {
    const content = '---\r\nname: demo-skill\r\ndescription: Use when validating skills.\r\n---\r\n\r\n# Demo\r\n'

    assert.deepEqual(extractFrontmatter(content), {
      name: 'demo-skill',
      description: 'Use when validating skills.',
    })
  })

  test('keeps colons that appear inside a value', () => {
    const content = '---\nname: demo-skill\nsource: https://example.com/path\n---\n'

    assert.deepEqual(extractFrontmatter(content), {
      name: 'demo-skill',
      source: 'https://example.com/path',
    })
  })

  test('treats a line without a bare word key as a continuation', () => {
    const content = '---\ndescription: first part\nnot-a-key: second part\n---\n'

    assert.deepEqual(extractFrontmatter(content), {
      description: 'first part not-a-key: second part',
    })
  })

  test('parses a key followed by a long run of spaces', () => {
    const content = `---\nname:${' '.repeat(40000)}demo\n---\n`

    assert.deepEqual(extractFrontmatter(content), {name: 'demo'})
  })
})
