import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {validateSkill} from '../../src/validate/index.js'

describe('validate/index', () => {
  test('accepts a valid minimal skill document', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-index-'))
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

      const result = await validateSkill(skillDir)
      assert.equal(result.skillName, 'valid-skill')
      assert.equal(result.skillPath, path.resolve(skillDir))
      assert.ok(Array.isArray(result.errors))
      assert.ok(Array.isArray(result.warnings))
      assert.ok(Array.isArray(result.infos))
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('flags a missing SKILL.md file', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-index-'))
    const skillDir = path.join(tmpDir, 'broken-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      const result = await validateSkill(skillDir)
      assert.equal(result.skillPath, path.resolve(skillDir))
      assert.equal(result.errors[0].code, 'skill.missing')
      assert.equal(result.errors[0].path, 'SKILL.md')
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('requires the canonical SKILL.md filename casing', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-index-'))
    const skillDir = path.join(tmpDir, 'lowercase-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(path.join(skillDir, 'skill.md'), '---\nname: lowercase-skill\ndescription: sample\n---\n')

      const result = await validateSkill(skillDir)
      assert.equal(result.skillPath, path.resolve(skillDir))
      assert.deepEqual(result.errors, [{code: 'skill.missing', message: 'SKILL.md not found', path: 'SKILL.md'}])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('promotes local paths to errors for the public profile', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-validate-index-'))
    const skillDir = path.join(tmpDir, 'public-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: public-skill
description: Use when testing public validation. Boundary: not for production.
license: MIT. See LICENSE file for details.
---

# Public Skill

Read /Users/example/private/input.md before continuing.
`,
      )

      const result = await validateSkill(skillDir, {profile: 'public'})
      assert.equal(result.profile, 'public')
      assert.ok(result.errors.some(issue => issue.code === 'security.local-path' && issue.path === 'SKILL.md'))
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
