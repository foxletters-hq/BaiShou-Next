import { describe, expect, it } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import {
  buildDesktopDiaryReEmbedArgs,
  resolveDesktopDiaryEmbedText
} from '../diary-embed-text.util'

describe('desktop diary embed text', () => {
  it('passes diary body and date prefix without tag metadata', () => {
    expect(resolveDesktopDiaryEmbedText('开会纪要 #工作', '2026-09-01')).toEqual({
      text: '开会纪要 #工作',
      chunkPrefix: '[2026-09-01 日记:]\n'
    })
    expect(
      resolveDesktopDiaryEmbedText('开会纪要', new Date(2026, 8, 1)).chunkPrefix
    ).not.toContain('标签')
  })

  it('builds realtime and batch re-embed args from the same helper', () => {
    const vaultId = deriveLegacyVaultId('Personal')
    const args = buildDesktopDiaryReEmbedArgs({
      content: '开会纪要',
      date: '2026-09-01',
      vaultId,
      diaryId: 42,
      updatedAt: new Date(2026, 8, 1, 12, 0, 0),
      skipIndexPrep: true
    })

    expect(args).toMatchObject({
      text: '开会纪要',
      chunkPrefix: '[2026-09-01 日记:]\n',
      sourceType: 'diary',
      sourceId: `${vaultId}#42`,
      groupId: 'diary',
      vaultId,
      skipIndexPrep: true
    })
    expect(args.chunkPrefix).not.toContain('标签')
    expect(JSON.parse(args.metadataJson)).toEqual({
      updated_at: new Date(2026, 8, 1, 12, 0, 0).getTime()
    })
  })
})
