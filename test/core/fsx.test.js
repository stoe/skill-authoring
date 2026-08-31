import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {readText, writeText, fileExists, listDir, walk, resolveSafeSkillPath} from '../../src/core/fsx.js'

describe('core/fsx', () => {
  test('reads and writes text files', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-fsx-'))
    const filePath = path.join(tmpDir, 'alpha.txt')

    try {
      await writeText(filePath, 'hello world')
      const result = await readText(filePath)
      assert.equal(result.text, 'hello world')
      assert.ok(result.mtimeMs > 0)
      assert.equal(await fileExists(filePath), true)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('lists and walks directories', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-fsx-'))
    const nestedDir = path.join(tmpDir, 'nested')

    try {
      await mkdir(nestedDir, {recursive: true})
      await writeFile(path.join(nestedDir, 'x.js'), 'console.log(1)')
      const entries = await listDir(tmpDir)
      assert.ok(entries.includes('nested'))

      const files = await walk(tmpDir, {patterns: ['.js']})
      assert.equal(files.length, 1)
      assert.equal(files[0].name, 'x.js')
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('resolves only safe skill paths', () => {
    const safe = resolveSafeSkillPath('/tmp/base', '.', 'demo-skill')
    assert.equal(safe.safe, true)
    assert.match(safe.skillPath, /demo-skill$/)

    const unsafe = resolveSafeSkillPath('/tmp/base', '../../outside', 'demo-skill')
    assert.equal(unsafe.safe, false)
    assert.match(unsafe.reason, /escapes the approved base directory/i)
  })
})
