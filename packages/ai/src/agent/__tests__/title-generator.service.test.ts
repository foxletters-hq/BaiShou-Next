import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TitleGeneratorService, cleanGeneratedTitle } from '../title-generator.service'

describe('cleanGeneratedTitle', () => {
  it('should clean quotes and brackets around title', () => {
    expect(cleanGeneratedTitle('"快速排序算法"')).toBe('快速排序算法')
    expect(cleanGeneratedTitle('《日记回顾与反思》')).toBe('日记回顾与反思')
    expect(cleanGeneratedTitle('“今日计划与日程”')).toBe('今日计划与日程')
    expect(cleanGeneratedTitle('【重要事项】')).toBe('重要事项')
  })

  it('should remove common prefixes like 标题：, 对话主题：', () => {
    expect(cleanGeneratedTitle('标题：快速排序算法')).toBe('快速排序算法')
    expect(cleanGeneratedTitle('对话名称: 智能体设计')).toBe('智能体设计')
    expect(cleanGeneratedTitle('会话主题 — 个人笔记总结')).toBe('个人笔记总结')
    expect(cleanGeneratedTitle('Topic: React Native')).toBe('React Native')
  })

  it('should strip trailing punctuation and markdown formatting', () => {
    expect(cleanGeneratedTitle('**今日总结**。')).toBe('今日总结')
    expect(cleanGeneratedTitle('`代码重构建议`！')).toBe('代码重构建议')
    expect(cleanGeneratedTitle('# 知识库梳理')).toBe('知识库梳理')
  })

  it('should only keep the first line and truncate to maxLength', () => {
    const multiline = '第一行标题\n第二行额外说明'
    expect(cleanGeneratedTitle(multiline)).toBe('第一行标题')

    const longText = '这是一个非常非常非常非常非常长的主题名称超过了十五个字符'
    expect(cleanGeneratedTitle(longText, 15)).toBe('这是一个非常非常非常非常非常长')
    expect(cleanGeneratedTitle(longText, 15).length).toBe(15)
  })

  it('should return empty string for empty or whitespace-only inputs', () => {
    expect(cleanGeneratedTitle('')).toBe('')
    expect(cleanGeneratedTitle('   ')).toBe('')
  })
})

describe('TitleGeneratorService', () => {
  let mockSessionRepo: any

  beforeEach(() => {
    TitleGeneratorService.onTitleUpdated = undefined
    mockSessionRepo = {
      getSessionById: vi.fn().mockResolvedValue({
        id: 's1',
        title: '初始标题',
        vaultId: 'v1',
        assistantId: 'a1',
        providerId: 'p1',
        modelId: 'm1'
      }),
      upsertSession: vi.fn().mockResolvedValue(undefined)
    }
  })

  it('should fallback to userText when naming model is not configured', async () => {
    await TitleGeneratorService.maybeUpdateSessionTitle({
      sessionRepo: mockSessionRepo,
      sessionId: 's1',
      userText: '帮我写个快速排序算法吧',
      namingModelConfigured: false
    })

    expect(mockSessionRepo.upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's1',
        title: '帮我写个快速排序算法'
      })
    )
  })

  it('should trigger onTitleUpdated callback after title update', async () => {
    const onTitleUpdated = vi.fn()
    TitleGeneratorService.onTitleUpdated = onTitleUpdated

    await TitleGeneratorService.applyTitleFromUserText(mockSessionRepo, 's1', '今天天气真好')

    expect(mockSessionRepo.upsertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's1',
        title: '今天天气真好'
      })
    )
    expect(onTitleUpdated).toHaveBeenCalledWith('s1', '今天天气真好')
  })

  it('should call autoTitle when naming model is configured', async () => {
    const mockProvider: any = {
      config: { id: 'p_test', type: 'openai' },
      getLanguageModel: vi.fn().mockReturnValue({})
    }

    const autoTitleSpy = vi.spyOn(TitleGeneratorService, 'autoTitle').mockResolvedValue(undefined)

    await TitleGeneratorService.maybeUpdateSessionTitle({
      sessionRepo: mockSessionRepo,
      sessionId: 's1',
      userText: '请帮我规划一份旅行路线',
      namingModelConfigured: true,
      namingProvider: mockProvider,
      namingModelId: 'gpt-4o-mini'
    })

    expect(autoTitleSpy).toHaveBeenCalledWith(
      mockProvider,
      'gpt-4o-mini',
      mockSessionRepo,
      's1',
      '请帮我规划一份旅行路线',
      undefined
    )

    autoTitleSpy.mockRestore()
  })
})
