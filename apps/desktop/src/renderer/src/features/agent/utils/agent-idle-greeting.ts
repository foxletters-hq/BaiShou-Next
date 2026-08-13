import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUserProfileStore } from '@baishou/store'

export const AGENT_IDLE_GREETING_KEYS = [
  'agent.idle_greeting_1',
  'agent.idle_greeting_2',
  'agent.idle_greeting_3',
  'agent.idle_greeting_4',
  'agent.idle_greeting_5',
  'agent.idle_greeting_6',
  'agent.idle_greeting_7',
  'agent.idle_greeting_8',
  'agent.idle_greeting_9',
  'agent.idle_greeting_10'
] as const

export const AGENT_IDLE_GREETING_FALLBACKS = [
  'Hi，{{name}}，今天过得怎么样？想跟我聊聊吗？',
  '{{name}}，有什么开心或烦心的事，都可以跟我说',
  '来吧 {{name}}，随便说说今天的感受',
  '{{name}}，今天心情如何？我在这儿听你说',
  '想聊聊今天发生的事吗？我陪着你，{{name}}',
  '{{name}}，有什么想倾诉的，慢慢说就好',
  '今天有没有特别的瞬间想分享？{{name}}，我听着',
  '累了就歇一会儿，也可以跟我说说话，{{name}}',
  '{{name}}，不管好坏，今天的心情都可以放在这儿',
  '嗨 {{name}}，今天想从哪一段感受开始聊？'
] as const

/** 伙伴页空态：Latte 右侧随机一句邀请分享感受（i18n） */
export function useAgentIdleGreeting(): string {
  const { t } = useTranslation()
  const nickname = useUserProfileStore((s) => s.profile?.nickname)
  const [index] = useState(() => Math.floor(Math.random() * AGENT_IDLE_GREETING_KEYS.length))

  return useMemo(() => {
    const name =
      (typeof nickname === 'string' && nickname.trim()) ||
      t('agent.idle_greeting_guest', '朋友')
    const key = AGENT_IDLE_GREETING_KEYS[index]!
    const fallback = AGENT_IDLE_GREETING_FALLBACKS[index]!
    return t(key, fallback, { name })
  }, [index, nickname, t])
}
