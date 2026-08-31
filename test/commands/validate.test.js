import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, writeFile, mkdir, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {validateCommand} from '../../src/commands/validate.js'

async function withSilencedConsole(callback) {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}

  try {
    return await callback()
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

describe('commands/validate', () => {
  test('returns zero for a valid skill directory', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'valid-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: valid-skill
description: Provides a sample skill. Use when validating skills in a project.
license: MIT. See LICENSE file for details.
---

# Valid Skill

This skill validates other skill content and is designed for local testing.
`,
      )

      const exitCode = await withSilencedConsole(async () =>
        validateCommand({
          skill: skillDir,
          all: false,
          format: 'pretty',
          failLevel: 'error',
        }),
      )

      assert.equal(exitCode, 0)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('returns one for a missing SKILL.md file', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'broken-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      const exitCode = await withSilencedConsole(async () =>
        validateCommand({
          skill: skillDir,
          all: false,
          format: 'pretty',
          failLevel: 'error',
        }),
      )

      assert.equal(exitCode, 1)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
