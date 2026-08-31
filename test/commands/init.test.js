import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {initCommand} from '../../src/commands/init.js'

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

describe('commands/init', () => {
  test('creates a valid skill scaffold', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-init-'))

    try {
      const exitCode = await withSilencedConsole(async () =>
        initCommand({
          name: 'demo-skill',
          outputDir: '.',
          force: false,
          baseDir: tmpDir,
        }),
      )

      assert.equal(exitCode, 0)
      const content = await readFile(path.join(tmpDir, 'demo-skill', 'SKILL.md'), 'utf8')
      assert.match(content, /^---\nname: demo-skill/m)
      assert.match(content, /# Skill Name/)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects invalid names', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-init-'))

    try {
      const exitCode = await withSilencedConsole(async () =>
        initCommand({
          name: 'Bad Name',
          outputDir: '.',
          baseDir: tmpDir,
        }),
      )

      assert.equal(exitCode, 1)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects path traversal outside the base directory', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-init-'))

    try {
      const exitCode = await withSilencedConsole(async () =>
        initCommand({
          name: 'demo-skill',
          outputDir: '../../outside',
          baseDir: tmpDir,
        }),
      )

      assert.equal(exitCode, 1)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
