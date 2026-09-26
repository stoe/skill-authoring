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

async function captureJson(callback) {
  const originalLog = console.log
  const output = []
  console.log = value => output.push(value)

  try {
    const exitCode = await callback()
    return {exitCode, json: JSON.parse(output.join('\n'))}
  } finally {
    console.log = originalLog
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
          target: skillDir,
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
          target: skillDir,
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

  test('includes issue arrays and counts in JSON output', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'broken-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      const {exitCode, json} = await captureJson(() =>
        validateCommand({
          target: skillDir,
          all: false,
          format: 'json',
          failLevel: 'error',
        }),
      )

      assert.equal(exitCode, 1)
      assert.deepEqual(json.skills, [
        {
          name: 'broken-skill',
          errors: [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md'}],
          warnings: [],
          errorCount: 1,
          warningCount: 0,
        },
      ])
      assert.deepEqual(json.summary, {
        totalErrors: 1,
        totalWarnings: 0,
      })
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects an unknown validation profile', async () => {
    await assert.rejects(
      () =>
        validateCommand({
          target: '.',
          profile: 'external',
        }),
      /Invalid profile: external/,
    )
  })

  test('requires confirmation before scanning an explicitly requested ignored root', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'ignored-skill')

    try {
      await mkdir(path.join(tmpDir, '.git'), {recursive: true})
      await writeFile(path.join(tmpDir, '.gitignore'), 'ignored-skill/\n')
      await mkdir(skillDir, {recursive: true})
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: ignored-skill
description: Provides a sample skill. Use when validating ignored skills.
license: MIT. See LICENSE file for details.
---

# Ignored Skill
`,
      )

      await assert.rejects(
        () =>
          withSilencedConsole(() =>
            validateCommand({
              all: true,
              target: skillDir,
              targetExplicit: true,
              confirmIgnoredRoot: async () => false,
            }),
          ),
        /Refusing to scan ignored path without confirmation/,
      )

      const exitCode = await withSilencedConsole(() =>
        validateCommand({
          all: true,
          target: skillDir,
          targetExplicit: true,
          confirmIgnoredRoot: async () => true,
        }),
      )
      assert.equal(exitCode, 0)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('--yes scans an explicitly requested ignored root without prompting', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'ignored-skill')

    try {
      await mkdir(path.join(tmpDir, '.git'), {recursive: true})
      await writeFile(path.join(tmpDir, '.gitignore'), 'ignored-skill/\n')
      await mkdir(skillDir, {recursive: true})
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: ignored-skill
description: Provides a sample skill. Use when validating ignored skills.
license: MIT. See LICENSE file for details.
---

# Ignored Skill
`,
      )

      const exitCode = await withSilencedConsole(() =>
        validateCommand({
          all: true,
          target: skillDir,
          targetExplicit: true,
          yes: true,
          confirmIgnoredRoot: async () => {
            throw new Error('confirmation should not be requested')
          },
        }),
      )
      assert.equal(exitCode, 0)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('validates one target unless --all enables recursive discovery', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const nestedSkill = path.join(tmpDir, 'plugins', 'nested-skill')

    try {
      await mkdir(nestedSkill, {recursive: true})
      await writeFile(
        path.join(nestedSkill, 'SKILL.md'),
        `---
name: nested-skill
description: Provides a sample skill. Use when testing recursive validation.
license: MIT. See LICENSE file for details.
---

# Nested Skill
`,
      )

      const singleResult = await captureJson(() =>
        validateCommand({
          target: tmpDir,
          format: 'json',
        }),
      )
      assert.equal(singleResult.exitCode, 1)
      assert.deepEqual(
        singleResult.json.skills.map(skill => skill.name),
        [path.basename(tmpDir)],
      )
      assert.equal(singleResult.json.skills[0].errors[0].code, 'skill.missing')

      const recursiveResult = await captureJson(() =>
        validateCommand({
          target: tmpDir,
          all: true,
          format: 'json',
        }),
      )
      assert.equal(recursiveResult.exitCode, 0)
      assert.deepEqual(
        recursiveResult.json.skills.map(skill => skill.name),
        ['nested-skill'],
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('accepts a SKILL.md file as a single target', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const skillDir = path.join(tmpDir, 'file-target')
    const skillFile = path.join(skillDir, 'SKILL.md')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(
        skillFile,
        `---
name: file-target
description: Provides a sample skill. Use when validating a SKILL.md target.
license: MIT. See LICENSE file for details.
---

# File Target
`,
      )

      const exitCode = await withSilencedConsole(() => validateCommand({target: skillFile}))
      assert.equal(exitCode, 0)
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('rejects invalid targets with explicit errors', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-'))
    const unsupportedFile = path.join(tmpDir, 'README.md')
    const skillFile = path.join(tmpDir, 'SKILL.md')

    try {
      await writeFile(unsupportedFile, '# Not a skill target\n')
      await writeFile(skillFile, '---\nname: root-skill\ndescription: sample\n---\n')

      await assert.rejects(() => validateCommand({target: path.join(tmpDir, 'missing')}), /Validation target not found/)
      await assert.rejects(() => validateCommand({target: unsupportedFile}), /must be a skill directory or SKILL\.md/)
      await assert.rejects(
        () => validateCommand({target: skillFile, all: true}),
        /Recursive validation target must be a directory/,
      )
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
