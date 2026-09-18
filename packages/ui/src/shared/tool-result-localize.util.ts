import i18n from 'i18next'
import { isCompanionAskCancelledMessage } from '@baishou/shared'
import { isCompanionAskDeclinedNotice } from './tool-result-companion-ask.util'
import type { ToolCopyTranslate } from './tool-result.types'

function interpolateToolCopy(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '')
}

export function formatToolCopy(
  t: ToolCopyTranslate,
  key: string,
  defaultValue: string,
  vars?: Record<string, string>
): string {
  const raw = t(key, vars ? { defaultValue, ...vars } : { defaultValue })
  const text = typeof raw === 'string' && raw.trim() ? raw.trim() : defaultValue
  const template = text === key || text.startsWith('agent.tools.') ? defaultValue : text
  return interpolateToolCopy(template, vars)
}

function localizeToolResultLine(
  line: string,
  t: ToolCopyTranslate,
  options: { skillSave: boolean }
): string {
  const trimmed = line.trimEnd()
  if (!trimmed) return line

  if (isCompanionAskCancelledMessage(trimmed) || isCompanionAskDeclinedNotice(trimmed)) {
    const cancelled = isCompanionAskCancelledMessage(trimmed)
    return formatToolCopy(
      t,
      cancelled ? 'agent.tools.companion_ask_cancelled' : 'agent.tools.companion_ask_declined',
      cancelled
        ? i18n.t('auto.packages.ui.src.shared.tool.result.util.L446', '用户取消了这一次操作')
        : i18n.t('auto.packages.ui.src.shared.tool.result.util.L446', '没有作答')
    )
  }

  if (/^Tool execution failed\.?$/.test(trimmed)) {
    return formatToolCopy(
      t,
      'agent.tools.execution_failed',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L450', '工具执行失败')
    )
  }

  const execFail = /^Tool execution failed:\s*(.*)$/.exec(trimmed)
  if (execFail) {
    const detail = execFail[1].trim()
    if (!detail)
      return formatToolCopy(
        t,
        'agent.tools.execution_failed',
        i18n.t('auto.packages.ui.src.shared.tool.result.util.L456', '工具执行失败')
      )
    return formatToolCopy(
      t,
      'agent.tools.execution_failed_with_detail',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L460', '工具执行失败：{{detail}}'),
      {
        detail
      }
    )
  }

  if (/^Error:\s*Skill writer is not available in this environment\.?$/.test(trimmed)) {
    return formatToolCopy(
      t,
      'agent.tools.skill_writer_unavailable',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L468', '当前环境无法写入技能')
    )
  }

  const skillFail = /^Error:\s*Failed to save skill:\s*(.*)$/.exec(trimmed)
  if (skillFail) {
    return formatToolCopy(
      t,
      'agent.tools.skill_write_failed',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L473', '未能保存技能：{{detail}}'),
      {
        detail: skillFail[1].trim()
      }
    )
  }

  const fetchFail = /^Failed to fetch URL:\s*(.*)$/.exec(trimmed)
  if (fetchFail) {
    return formatToolCopy(
      t,
      'agent.tools.fetch_url_failed',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L480', '读取网页失败：{{detail}}'),
      {
        detail: fetchFail[1].trim()
      }
    )
  }

  const searchFail = /^Web search failed:\s*(.*)$/.exec(trimmed)
  if (searchFail) {
    return formatToolCopy(
      t,
      'agent.tools.web_search_failed',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L487', '网络搜索失败：{{detail}}'),
      {
        detail: searchFail[1].trim()
      }
    )
  }

  const genericError = /^Error:\s*(.*)$/.exec(trimmed)
  if (genericError) {
    const detail = genericError[1].trim()
    if (!detail)
      return formatToolCopy(
        t,
        'agent.tools.execution_failed',
        i18n.t('auto.packages.ui.src.shared.tool.result.util.L495', '工具执行失败')
      )
    return formatToolCopy(
      t,
      'agent.tools.error_with_detail',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L496', '出错：{{detail}}'),
      { detail }
    )
  }

  if (options.skillSave) {
    const saved = /^Saved skill "([^"]+)"\.$/.exec(trimmed)
    if (saved) {
      return formatToolCopy(
        t,
        'agent.tools.skill_saved',
        i18n.t('auto.packages.ui.src.shared.tool.result.util.L502', '已保存技能「{{name}}」。'),
        {
          name: saved[1]
        }
      )
    }
    const loc = /^Location:\s*(.*)$/.exec(trimmed)
    if (loc) {
      return formatToolCopy(
        t,
        'agent.tools.skill_saved_location',
        i18n.t('auto.packages.ui.src.shared.tool.result.util.L508', '位置：{{detail}}'),
        {
          detail: loc[1]
        }
      )
    }
    const desc = /^Description:\s*(.*)$/.exec(trimmed)
    if (desc) {
      return formatToolCopy(
        t,
        'agent.tools.skill_saved_description',
        i18n.t('auto.packages.ui.src.shared.tool.result.util.L514', '说明：{{detail}}'),
        {
          detail: desc[1]
        }
      )
    }
  }

  return line
}

/** 将工具结果中的固定英文前缀译成当前界面语言；检测逻辑仍认英文原文 */
export function localizeToolResultText(text: string, t: ToolCopyTranslate): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const skillSave = /^Saved skill "/.test(lines[0]?.trim() ?? '')
  return lines.map((line) => localizeToolResultLine(line, t, { skillSave })).join('\n')
}
