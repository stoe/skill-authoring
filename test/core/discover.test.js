import {describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {discoverSkills, inspectDiscoveryRoot, resolveSkillPaths} from '../../src/core/discover.js'

async function writeSkill(skillDir, filename = 'SKILL.md') {
  await mkdir(skillDir, {recursive: true})
  await writeFile(path.join(skillDir, filename), '---\nname: sample-skill\ndescription: sample\n---\n')
}

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

  test('includes the root and recursively discovers nested skills in sorted order', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const nestedSkill = path.join(tmpDir, 'z-parent', 'nested-skill')
    const siblingSkill = path.join(tmpDir, 'a-skill')

    try {
      await writeSkill(tmpDir)
      await writeSkill(nestedSkill)
      await writeSkill(siblingSkill)

      const skills = await discoverSkills(tmpDir)
      assert.deepEqual(skills, [tmpDir, siblingSkill, nestedSkill].sort())
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('discovers case variants of skill.md', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const lowercaseSkill = path.join(tmpDir, 'lowercase-skill')

    try {
      await writeSkill(lowercaseSkill, 'skill.md')
      assert.deepEqual(await discoverSkills(tmpDir), [lowercaseSkill])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('honors nested .gitignore rules and negation', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const includedSkill = path.join(tmpDir, 'generated', 'keep')
    const ignoredSkill = path.join(tmpDir, 'generated', 'drop')
    const nestedIgnoredSkill = path.join(tmpDir, 'nested', 'ignored')

    try {
      await mkdir(path.join(tmpDir, '.git'), {recursive: true})
      await writeFile(path.join(tmpDir, '.gitignore'), 'generated/*\n!generated/keep/\n')
      await writeSkill(includedSkill)
      await writeSkill(ignoredSkill)
      await mkdir(path.join(tmpDir, 'nested'), {recursive: true})
      await writeFile(path.join(tmpDir, 'nested', '.gitignore'), 'ignored/\n')
      await writeSkill(nestedIgnoredSkill)

      assert.deepEqual(await discoverSkills(tmpDir), [includedSkill])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })

  test('does not follow directory symlinks', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const externalDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-external-'))
    const externalSkill = path.join(externalDir, 'external-skill')

    try {
      await writeSkill(externalSkill)
      await symlink(externalDir, path.join(tmpDir, 'linked-skills'), 'dir')

      assert.deepEqual(await discoverSkills(tmpDir), [])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
      await rm(externalDir, {recursive: true, force: true})
    }
  })

  test('detects an explicitly requested ignored root and can scan it after confirmation', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'skill-authoring-discover-'))
    const ignoredRoot = path.join(tmpDir, 'ignored-root')
    const ignoredNestedSkill = path.join(ignoredRoot, 'skip')

    try {
      await mkdir(path.join(tmpDir, '.git'), {recursive: true})
      await writeFile(path.join(tmpDir, '.gitignore'), 'ignored-root/\n')
      await writeSkill(ignoredRoot)
      await writeFile(path.join(ignoredRoot, '.gitignore'), 'skip/\n')
      await writeSkill(ignoredNestedSkill)

      const rootStatus = await inspectDiscoveryRoot(ignoredRoot)
      assert.equal(rootStatus.ignored, true)
      assert.deepEqual(await discoverSkills(ignoredRoot, {rootStatus}), [])
      assert.deepEqual(await discoverSkills(ignoredRoot, {rootStatus, allowIgnoredRoot: true}), [ignoredRoot])
    } finally {
      await rm(tmpDir, {recursive: true, force: true})
    }
  })
})
