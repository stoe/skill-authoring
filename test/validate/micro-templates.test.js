import {describe, test} from 'node:test'
import assert from 'node:assert/strict'

import {validateMicroTemplate} from '../../src/validate/micro-templates.js'

const codes = description => validateMicroTemplate(description).map(issue => issue.code)

// Adversarial inputs took seconds before the patterns were made unambiguous, so
// a one second budget separates a fixed pattern from a regressed one.
const REDOS_BUDGET_MS = 1000
const REDOS_LENGTH = 40000

function elapsed(description) {
  const start = process.hrtime.bigint()
  validateMicroTemplate(description)
  return Number(process.hrtime.bigint() - start) / 1e6
}

describe('validate/micro-templates', () => {
  test('accepts a description with trigger context and no violations', () => {
    assert.deepEqual(codes('Provides skill validation. Use when checking a skill.'), [])
  })

  describe('link detection', () => {
    test('reports a bare URL', () => {
      assert.ok(codes('Use when linking. See https://example.com').includes('desc.links'))
    })

    test('reports a Markdown link', () => {
      assert.ok(codes('Use when linking. Read [the docs](guide.md)').includes('desc.links'))
    })

    test('allows brackets and parentheses that are not a link', () => {
      assert.ok(!codes('Use when grouping [alpha] and (beta)').includes('desc.links'))
    })
  })

  describe('XML tag detection', () => {
    test('reports an XML tag', () => {
      assert.ok(codes('Use when tagging. Contains <div> markup').includes('desc.xml'))
    })

    test('reports a tag that follows an unclosed bracket', () => {
      assert.ok(codes('Use when tagging. Contains <a<b> markup').includes('desc.xml'))
    })

    test('allows a less-than sign that does not open a tag', () => {
      assert.ok(!codes('Use when comparing 5 < 10 values').includes('desc.xml'))
    })
  })

  describe('trailing whitespace', () => {
    test('reports a trailing space', () => {
      assert.ok(codes('Use when trimming. ').includes('desc.trailing'))
    })

    test('reports a trailing tab', () => {
      assert.ok(codes('Use when trimming.\t').includes('desc.trailing'))
    })

    test('ignores a description that does not end in whitespace', () => {
      assert.ok(!codes('Use when trimming.').includes('desc.trailing'))
    })
  })

  describe('non-string input', () => {
    for (const value of [undefined, null, 42]) {
      test(`returns issues without throwing for ${String(value)}`, () => {
        assert.doesNotThrow(() => validateMicroTemplate(value))
        assert.ok(!codes(value).includes('desc.trailing'))
      })
    }
  })

  describe('resists polynomial backtracking', () => {
    test('handles repeated opening brackets', () => {
      assert.ok(elapsed(`Use when stressing. ${'['.repeat(REDOS_LENGTH)}`) < REDOS_BUDGET_MS)
    })

    test('handles repeated tag openings', () => {
      assert.ok(elapsed(`Use when stressing. ${'<A'.repeat(REDOS_LENGTH / 2)}`) < REDOS_BUDGET_MS)
    })

    test('handles repeated tabs before a trailing tab', () => {
      assert.ok(elapsed(`Use when stressing. ${'\t'.repeat(REDOS_LENGTH)}x\t`) < REDOS_BUDGET_MS)
    })
  })
})
