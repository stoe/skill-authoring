import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {mkdtemp, rm, readFile, stat} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {promisify} from 'node:util'

const execFileAsync = promisify(execFile)
const cliPath = path.resolve(import.meta.dirname, '../cli.js')

describe('CLI', () => {
  test('shows help text for default command', async () => {
    const {stdout, stderr} = await execFileAsync(process.execPath, [cliPath, '--help'])
    assert.equal(stderr, '')
    assert.match(stdout, /Usage: .*validate/)
    assert.match(stdout, /--fail-level/)
  })

  test('creates a skill with init and exits zero', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))

    try {
      const {stdout, stderr} = await execFileAsync(process.execPath, [cliPath, 'init', 'demo-skill'], {
        cwd: tmpDir,
      })

      assert.equal(stderr, '')
      assert.match(stdout, /Created skill directory structure/i)

      const skillPath = path.join(tmpDir, 'demo-skill')
      const statResult = await stat(path.join(skillPath, 'SKILL.md'))
      assert.ok(statResult.isFile())
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('returns a non-zero exit code for an unknown command', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))

    try {
      await assert.rejects(
        () => execFileAsync(process.execPath, [cliPath, 'does-not-exist'], {cwd: tmpDir}),
        /Command failed/,
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
