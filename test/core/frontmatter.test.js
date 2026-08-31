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
})
