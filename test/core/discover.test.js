import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {discoverSkills, resolveSkillPaths} from '../../src/core/discover.js'

describe('core/discover', () => {
  test('discovers a directory containing SKILL.md', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const skillDir = path.join(tmpDir, 'sample-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: sample-skill\ndescription: sample\n---\n')

      const skills = await discoverSkills(tmpDir)
      assert.deepEqual(skills, [skillDir])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('resolves a single skill path from a directory or SKILL.md file', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const skillDir = path.join(tmpDir, 'sample-skill')

    try {
      await mkdir(skillDir, {recursive: true})
      await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: sample-skill\ndescription: sample\n---\n')

      const fromDir = await resolveSkillPaths([skillDir], tmpDir)
      const fromFile = await resolveSkillPaths([path.join(skillDir, 'SKILL.md')], tmpDir)
      assert.deepEqual(fromDir, [skillDir])
      assert.deepEqual(fromFile, [skillDir])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
