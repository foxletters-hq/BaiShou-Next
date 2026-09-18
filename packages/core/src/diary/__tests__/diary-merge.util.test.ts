import { describe, expect, it } from 'vitest'
import type { Diary, UpdateDiaryInput } from '@baishou/shared'
import { mergeDiariesOnDateJump } from '../diary-merge.util'

function target(overrides: Partial<Diary> = {}): Diary {
  return {
    id: 1,
    date: new Date('2024-01-01T00:00:00.000Z'),
    content: '旧正文',
    tags: '工作,生活',
    weather: '晴',
    mood: '平静',
    location: '上海',
    locationDetail: '办公室',
    isFavorite: true,
    mediaPaths: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Diary
}

describe('mergeDiariesOnDateJump', () => {
  it('should append source content when the target already has text', () => {
    const source: UpdateDiaryInput = { content: '新正文' }
    mergeDiariesOnDateJump(source, target())
    expect(source.content).toBe('旧正文\n\n新正文')
  })

  it('should keep only source content when the target is empty', () => {
    const source: UpdateDiaryInput = { content: '新正文' }
    mergeDiariesOnDateJump(source, target({ content: '   ' }))
    expect(source.content).toBe('新正文')
  })

  it('should merge tags and keep target weather when source omits it', () => {
    const source: UpdateDiaryInput = { content: '新', tags: '旅行' }
    mergeDiariesOnDateJump(source, target())
    expect(String(source.tags).split(',')).toEqual(expect.arrayContaining(['工作', '生活', '旅行']))
    expect(source.weather).toBe('晴')
    expect(source.isFavorite).toBe(true)
  })
})
