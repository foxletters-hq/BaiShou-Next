import { describe, it, expect } from 'vitest'
import { buildToolUsageGuidelines } from '../agent/tool-usage-guidelines.util'

describe('buildToolUsageGuidelines', () => {
  it('requires diary/vector lookup when search tools are available', () => {
    const guidelines = buildToolUsageGuidelines([
      'diary_search',
      'vector_search',
      'diary_read',
      'diary_edit'
    ])

    expect(guidelines).toContain('查事实，禁止装懂')
    expect(guidelines).toContain('diary_search')
    expect(guidelines).toContain('vector_search')
    expect(guidelines).toContain('不得猜测')
    expect(guidelines).toContain('编辑日记前先读取')
  })

  it('should require session_list then message_search when recalling a time period', () => {
    const guidelines = buildToolUsageGuidelines(['session_list', 'message_search', 'current_time'])

    expect(guidelines).toContain('查事实，禁止装懂')
    expect(guidelines).toContain('session_list')
    expect(guidelines).toContain('message_search')
    expect(guidelines).toContain('current_time')
    expect(guidelines).toContain('压缩摘要')
    expect(guidelines).toContain('同时填写 start_date 和 end_date')
  })

  it('should mention only session_list when message_search is unavailable', () => {
    const guidelines = buildToolUsageGuidelines(['session_list', 'current_time'])
    expect(guidelines).toContain('session_list')
    expect(guidelines).not.toContain('再用 message_search')
  })

  it('should mention only message_search when session_list is unavailable', () => {
    const guidelines = buildToolUsageGuidelines(['message_search'])
    expect(guidelines).toContain('message_search')
    expect(guidelines).not.toContain('用 session_list')
  })

  it('allows skipping search when neither diary_search nor vector_search is enabled', () => {
    const guidelines = buildToolUsageGuidelines(['diary_read', 'diary_list', 'diary_edit'])

    expect(guidelines).toContain('个人记录查阅说明')
    expect(guidelines).toContain('未启用日记关键词搜索与语义搜索')
    expect(guidelines).not.toContain('必须先调用 diary_search')
    expect(guidelines).toContain('编辑日记前先读取')
  })

  it('requires diary_read before diary_edit when both are enabled', () => {
    const guidelines = buildToolUsageGuidelines(['diary_read', 'diary_edit'])

    expect(guidelines).toContain('编辑日记前先读取')
    expect(guidelines).toContain('diary_read')
    expect(guidelines).toContain('diary_edit')
    expect(guidelines).toContain('保留已有段落')
    expect(guidelines).not.toContain('会被系统拒绝')
  })

  it('returns null for work-partner style tool sets without diary tools', () => {
    expect(buildToolUsageGuidelines(['web_search', 'current_time'])).toBeNull()
  })

  it('requires companion_ask instead of plain-text questions', () => {
    const guidelines = buildToolUsageGuidelines(['companion_ask', 'workspace_list'])
    expect(guidelines).toContain('向用户提问')
    expect(guidelines).toContain('companion_ask')
    expect(guidelines).toContain('questions')
    expect(guidelines).toContain('同一张确认卡')
    expect(guidelines).toContain('不要把问题写在普通回复里')
    expect(guidelines).toContain('用户取消了这一次操作')
    expect(guidelines).toContain('用自然语言询问用户接下来希望怎么做')
  })

  it('requires unique memory id when memory_delete is available', () => {
    const guidelines = buildToolUsageGuidelines(['memory_delete', 'vector_search'])
    expect(guidelines).toContain('删除记忆必须使用唯一 id')
    expect(guidelines).toContain('memory_id')
    expect(guidelines).toContain('禁止用描述')
  })
})
