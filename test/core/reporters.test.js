import {describe, test} from 'node:test'
import assert from 'node:assert/strict'

import {reportBatch} from '../../src/core/reporters.js'

function captureJson(callback) {
  const originalLog = console.log
  const output = []
  console.log = value => output.push(value)

  try {
    const exitCode = callback()
    return {exitCode, json: JSON.parse(output.join('\n'))}
  } finally {
    console.log = originalLog
  }
}

describe('core/reporters', () => {
  test('reports per-skill issue arrays and counts as JSON', () => {
    const results = [
      {
        skillName: 'broken-skill',
        errors: [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md', internal: true}],
        warnings: [{code: 'name.vague', message: 'Name contains a vague term'}],
        infos: [],
      },
      {
        skillName: 'valid-skill',
        errors: [],
        warnings: [],
        infos: [],
      },
    ]

    const {exitCode, json} = captureJson(() => reportBatch(results, 'json'))

    assert.equal(exitCode, 1)
    assert.deepEqual(json, {
      skills: [
        {
          name: 'broken-skill',
          errors: [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md'}],
          warnings: [{code: 'name.vague', message: 'Name contains a vague term', path: null}],
          errorCount: 1,
          warningCount: 1,
        },
        {
          name: 'valid-skill',
          errors: [],
          warnings: [],
          errorCount: 0,
          warningCount: 0,
        },
      ],
      summary: {
        totalErrors: 1,
        totalWarnings: 1,
      },
    })
  })

  test('preserves warning fail-level behavior for JSON output', () => {
    const results = [
      {
        skillName: 'warning-skill',
        errors: [],
        warnings: [{code: 'skill.lines', message: 'SKILL.md has too many lines'}],
        infos: [],
      },
    ]

    assert.equal(captureJson(() => reportBatch(results, 'json', 'error')).exitCode, 0)
    assert.equal(captureJson(() => reportBatch(results, 'json', 'warning')).exitCode, 1)
  })
})
