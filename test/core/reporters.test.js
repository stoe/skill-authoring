import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'

import {createReporter, reportBatch} from '../../src/core/reporters.js'

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
    const brokenSkillPath = path.resolve('fixtures/broken-skill')
    const validSkillPath = path.resolve('fixtures/valid-skill')
    const results = [
      {
        skillName: 'broken-skill',
        skillPath: brokenSkillPath,
        errors: [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md', internal: true}],
        warnings: [{code: 'name.vague', message: 'Name contains a vague term'}],
        infos: [],
      },
      {
        skillName: 'valid-skill',
        skillPath: validSkillPath,
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
          path: brokenSkillPath,
          errors: [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md'}],
          warnings: [{code: 'name.vague', message: 'Name contains a vague term', path: null}],
          errorCount: 1,
          warningCount: 1,
        },
        {
          name: 'valid-skill',
          path: validSkillPath,
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
        skillPath: path.resolve('fixtures/warning-skill'),
        errors: [],
        warnings: [{code: 'skill.lines', message: 'SKILL.md has too many lines'}],
        infos: [],
      },
    ]

    assert.equal(captureJson(() => reportBatch(results, 'json', 'error')).exitCode, 0)
    assert.equal(captureJson(() => reportBatch(results, 'json', 'warning')).exitCode, 1)
  })

  test('includes the skill name and absolute path in standalone JSON output', () => {
    const skillPath = path.resolve('fixtures/standalone-skill')
    const result = {
      skillName: 'standalone-skill',
      skillPath,
      errors: [],
      warnings: [],
      infos: [],
    }

    const {exitCode, json} = captureJson(() => createReporter('json')(result))
    assert.equal(exitCode, 0)
    assert.equal(json.name, 'standalone-skill')
    assert.equal(json.path, skillPath)
  })

  test('uses the absolute skill path in pretty output', () => {
    const originalLog = console.log
    const output = []
    const skillPath = path.resolve('fixtures/pretty-skill')
    console.log = value => output.push(value)

    try {
      createReporter('pretty')({
        skillName: 'pretty-skill',
        skillPath,
        errors: [],
        warnings: [],
        infos: [],
      })
    } finally {
      console.log = originalLog
    }

    assert.match(output.join('\n'), new RegExp(`Validating skill at: ${escapeRegExp(skillPath)}`))
  })
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
