import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {mkdtemp, mkdir, rm, stat, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {promisify} from 'node:util'

const execFileAsync = promisify(execFile)
const cliPath = path.resolve(import.meta.dirname, '../cli.js')

async function writeValidSkill(skillDir, name) {
  await mkdir(skillDir, {recursive: true})
  await writeFile(
    path.join(skillDir, 'SKILL.md'),
    `---
name: ${name}
description: Provides a sample skill. Use when testing recursive CLI discovery.
license: MIT. See LICENSE file for details.
---

# ${name}
`,
  )
}

describe('CLI', () => {
  test('shows positional validation help', async () => {
    const {stdout, stderr} = await execFileAsync(process.execPath, [cliPath, '--help'])
    assert.equal(stderr, '')
    assert.match(stdout, /Usage: .*validate \[options\] \[path\]/)
    assert.match(stdout, /\[path\].*Skill directory or SKILL\.md file/)
    assert.match(stdout, /--fail-level/)
    assert.match(stdout, /--profile/)
    assert.doesNotMatch(stdout, /--skill/)
    assert.doesNotMatch(stdout, /--path/)
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

  test('validates a positional target and only recurses with --all', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))
    const nestedSkill = path.join(tmpDir, 'packages', 'nested-skill')

    try {
      await writeValidSkill(nestedSkill, 'nested-skill')

      const single = await execFileAsync(process.execPath, [cliPath, 'validate', nestedSkill, '--format', 'json'], {
        cwd: os.tmpdir(),
      })
      assert.equal(single.stderr, '')
      const singleSkills = JSON.parse(single.stdout).skills
      assert.deepEqual(
        singleSkills.map(skill => skill.name),
        ['nested-skill'],
      )
      assert.deepEqual(
        singleSkills.map(skill => skill.path),
        [path.resolve(nestedSkill)],
      )

      await assert.rejects(
        () => execFileAsync(process.execPath, [cliPath, 'validate', tmpDir, '--format', 'json'], {cwd: os.tmpdir()}),
        error => {
          const output = JSON.parse(error.stdout)
          assert.deepEqual(
            output.skills.map(skill => skill.name),
            [path.basename(tmpDir)],
          )
          assert.deepEqual(
            output.skills.map(skill => skill.path),
            [path.resolve(tmpDir)],
          )
          assert.equal(output.skills[0].errors[0].code, 'skill.missing')
          return true
        },
      )

      const recursive = await execFileAsync(
        process.execPath,
        [cliPath, 'validate', '--all', tmpDir, '--format', 'json'],
        {cwd: os.tmpdir()},
      )
      assert.equal(recursive.stderr, '')
      const recursiveSkills = JSON.parse(recursive.stdout).skills
      assert.deepEqual(
        recursiveSkills.map(skill => skill.name),
        ['nested-skill'],
      )
      assert.deepEqual(
        recursiveSkills.map(skill => skill.path),
        [path.resolve(nestedSkill)],
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('uses the current directory when the validation path is omitted', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))
    const currentSkill = path.join(tmpDir, 'current-skill')

    try {
      await writeValidSkill(currentSkill, 'current-skill')

      const single = await execFileAsync(process.execPath, [cliPath, 'validate', '--format', 'json'], {
        cwd: currentSkill,
      })
      assert.deepEqual(
        JSON.parse(single.stdout).skills.map(skill => skill.name),
        ['current-skill'],
      )

      const recursive = await execFileAsync(process.execPath, [cliPath, 'validate', '--all', '--format', 'json'], {
        cwd: tmpDir,
      })
      assert.deepEqual(
        JSON.parse(recursive.stdout).skills.map(skill => skill.name),
        ['current-skill'],
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects removed target options and multiple positional paths', async () => {
    for (const removedOption of ['--skill', '--path', '-s', '-p']) {
      await assert.rejects(
        () => execFileAsync(process.execPath, [cliPath, 'validate', removedOption, '.']),
        /Command failed/,
      )
    }

    await assert.rejects(
      () => execFileAsync(process.execPath, [cliPath, 'validate', '.', './other']),
      error => {
        assert.match(error.stderr, /Expected at most one validation path/)
        return true
      },
    )
  })

  test('rejects a SKILL.md file as a recursive target', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))
    const skillDir = path.join(tmpDir, 'file-target')

    try {
      await writeValidSkill(skillDir, 'file-target')

      await assert.rejects(
        () => execFileAsync(process.execPath, [cliPath, 'validate', '--all', path.join(skillDir, 'SKILL.md')]),
        error => {
          assert.match(error.stderr, /Recursive validation target must be a directory/)
          return true
        },
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('requires --yes for an ignored explicit root in non-interactive execution', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-cli-'))
    const ignoredSkill = path.join(tmpDir, 'ignored-skill')

    try {
      await mkdir(path.join(tmpDir, '.git'), {recursive: true})
      await writeFile(path.join(tmpDir, '.gitignore'), 'ignored-skill/\n')
      await writeValidSkill(ignoredSkill, 'ignored-skill')

      await assert.rejects(
        () =>
          execFileAsync(process.execPath, [cliPath, 'validate', '--all', ignoredSkill, '--format', 'json'], {
            cwd: os.tmpdir(),
          }),
        error => {
          assert.match(error.stderr, /requested path is ignored/)
          assert.match(error.stderr, /Rerun with --yes/)
          assert.equal(error.stdout, '')
          return true
        },
      )

      const {stdout, stderr} = await execFileAsync(
        process.execPath,
        [cliPath, 'validate', '--all', ignoredSkill, '--yes', '--format', 'json'],
        {cwd: os.tmpdir()},
      )
      assert.match(stderr, /requested path is ignored/)
      assert.deepEqual(
        JSON.parse(stdout).skills.map(skill => skill.name),
        ['ignored-skill'],
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
