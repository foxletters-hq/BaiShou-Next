import { describe, expect, it } from 'vitest'
import {
  appendDiaryContent,
  isDiaryEditOverwriteMode,
  prepareDiarySearcherEdit,
  prepareDiarySearcherWrite,
  resolveDiaryEditMode
} from '../diary-edit-policy.util'

describe('diary-edit-policy.util', () => {
  it('detects overwrite mode', () => {
    expect(isDiaryEditOverwriteMode('overwrite')).toBe(true)
    expect(isDiaryEditOverwriteMode('append')).toBe(false)
    expect(isDiaryEditOverwriteMode(undefined)).toBe(false)
  })

  it('resolves edit mode', () => {
    expect(resolveDiaryEditMode()).toBe('append')
    expect(resolveDiaryEditMode('append')).toBe('append')
    expect(resolveDiaryEditMode('overwrite')).toBe('overwrite')
  })

  it('原样追加助手写出的时间标题，不自动添加或删除标题', () => {
    expect(
      appendDiaryContent('##### 09:00\n\n早上的记录', '###### 15:30 - 下午茶\n\n下午的记录')
    ).toBe('##### 09:00\n\n早上的记录\n\n###### 15:30 - 下午茶\n\n下午的记录')
  })

  it('追加时只规范段落边界的空行', () => {
    expect(appendDiaryContent('已有正文\n\n', '\n\n新增正文')).toBe('已有正文\n\n新增正文')
    expect(appendDiaryContent('', '##### 15:30\n\n新增正文')).toBe('##### 15:30\n\n新增正文')
    expect(appendDiaryContent('已有正文', '')).toBe('已有正文')
  })

  it('助手写入入口只传递 content，不附带 tags', () => {
    expect(prepareDiarySearcherWrite('##### 10:30\n\n#工作\n\n完成了方案')).toEqual({
      content: '##### 10:30\n\n#工作\n\n完成了方案'
    })
    expect(prepareDiarySearcherWrite('##### 10:30\n\n#工作\n\n完成了方案')).not.toHaveProperty(
      'tags'
    )
  })

  it('助手编辑入口追加与覆盖都只返回 content', () => {
    expect(
      prepareDiarySearcherEdit('##### 09:00\n\n早上的记录', '###### 15:30\n\n下午的记录')
    ).toEqual({
      content: '##### 09:00\n\n早上的记录\n\n###### 15:30\n\n下午的记录'
    })
    expect(
      prepareDiarySearcherEdit(
        '##### 09:00\n\n早上的记录',
        '###### 15:30\n\n下午的记录',
        'overwrite'
      )
    ).toEqual({
      content: '###### 15:30\n\n下午的记录'
    })
    expect(prepareDiarySearcherEdit('已有正文', '新段落', 'append')).not.toHaveProperty('tags')
  })
})
