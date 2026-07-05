import { GITHUB_ISSUES_URL } from './github.constants'

/** 飞书问题反馈表单（无需登录即可填写） */
export const FEISHU_FEEDBACK_FORM_URL =
  'https://ecnqgobp3kng.feishu.cn/share/base/form/shrcn5O5g1BpWERiRV7eDV8hLIb'

export const FEEDBACK_CHANNEL_GITHUB = 'github' as const
export const FEEDBACK_CHANNEL_FEISHU = 'feishu' as const

export type FeedbackChannel = typeof FEEDBACK_CHANNEL_GITHUB | typeof FEEDBACK_CHANNEL_FEISHU

export function resolveFeedbackChannelUrl(channel: string): string | null {
  if (channel === FEEDBACK_CHANNEL_GITHUB) return GITHUB_ISSUES_URL
  if (channel === FEEDBACK_CHANNEL_FEISHU) return FEISHU_FEEDBACK_FORM_URL
  return null
}
