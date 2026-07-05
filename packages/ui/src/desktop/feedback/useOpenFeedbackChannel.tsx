import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FEEDBACK_CHANNEL_FEISHU,
  FEEDBACK_CHANNEL_GITHUB,
  resolveFeedbackChannelUrl
} from '@baishou/shared'
import githubIcon from '@baishou/shared/assets/icons/feedback-github.svg'
import feishuIcon from '@baishou/shared/assets/icons/feedback-feishu.svg'
import { useDialog } from '../Dialog'

export function useOpenFeedbackChannel(openUrl: (url: string) => void | Promise<void>) {
  const dialog = useDialog()
  const { t } = useTranslation()

  return useCallback(async () => {
    const choice = await dialog.choose(
      t('settings.feedback', '问题反馈'),
      [
        {
          value: FEEDBACK_CHANNEL_GITHUB,
          label: t('settings.feedback_github', 'GitHub Issues'),
          leading: <img src={githubIcon} alt="" width={22} height={22} />
        },
        {
          value: FEEDBACK_CHANNEL_FEISHU,
          label: t('settings.feedback_feishu', '飞书表格（免登录）'),
          leading: <img src={feishuIcon} alt="" width={22} height={22} />
        }
      ],
      t('settings.feedback_choose_hint', '请选择你希望使用的反馈方式')
    )

    if (!choice) return
    const url = resolveFeedbackChannelUrl(choice)
    if (url) await openUrl(url)
  }, [dialog, openUrl, t])
}
