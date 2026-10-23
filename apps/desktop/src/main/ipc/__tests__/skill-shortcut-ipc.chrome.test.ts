import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const indexSrc = readFileSync(join(dir, '../../index.ts'), 'utf8')
const skillSrc = readFileSync(join(dir, '../skill.ipc.ts'), 'utf8')

function listTracedChannels(src: string): string[] {
  return [...src.matchAll(/tracedIpcHandle\(\s*'([^']+)'/g)].map((match) => match[1])
}

describe('skill shortcut ipc chrome', () => {
  it('should register shortcuts channels from skill ipc when booting business ipc', () => {
    expect(indexSrc).toContain('registerSkillIPC()')
    expect(indexSrc).not.toContain('registerShortcutIPC(')
    expect(listTracedChannels(skillSrc)).toEqual(
      expect.arrayContaining([
        'shortcuts:get-all',
        'shortcuts:save-all',
        'shortcuts:add',
        'shortcuts:update',
        'shortcuts:delete'
      ])
    )
  })

  it('should keep skills channels in skill ipc when exposing shortcut compatibility', () => {
    expect(listTracedChannels(skillSrc)).toEqual(
      expect.arrayContaining(['skills:list', 'skills:list-as-shortcuts', 'skills:create'])
    )
  })
})
