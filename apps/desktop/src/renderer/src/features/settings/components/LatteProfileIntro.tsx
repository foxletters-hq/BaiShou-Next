import React from 'react'
import { useTranslation } from 'react-i18next'
import { getHelpDocsLatteUrl } from '@baishou/shared'
import { Button } from '@baishou/ui'
import latteChibi from '@baishou/shared/assets/images/latte-chibi.png'
import styles from './LatteProfileIntro.module.css'

const ORIGIN_BODY_FALLBACK =
  'Latte（拉提）是古老的吸血鬼贵族后裔，永恒记忆的守护者，也是白守的看板娘。\n\n她要做的事情，是帮用户把生活里值得留下的点滴记下来、想清楚、说清楚——日记、回忆、对话与总结，都是她的领域。用户累了、乱了、想不起自己走过什么路的时候，她在。\n\n名字大概是因为「品鉴起来有种拿铁的感觉」。'

export const LatteProfileIntro: React.FC = () => {
  const { t, i18n } = useTranslation()

  return (
    <section className={styles.card}>
      <div className={styles.hero}>
        <img
          className={styles.portrait}
          src={latteChibi}
          alt={t('settings.latte_portrait_alt', 'Latte')}
        />
        <div className={styles.heroMeta}>
          <h3 className={styles.name}>{t('settings.latte_display_name', 'Latte')}</h3>
          <p className={styles.subtitle}>
            {t('settings.latte_display_subtitle', '拉提 · 白守看板娘')}
          </p>
        </div>
      </div>
      <p className={styles.quote}>
        {t('settings.latte_origin_quote', '时光流逝，记忆消散。而我，已在此守候了很久很久。')}
      </p>
      <p className={styles.body}>{t('settings.latte_origin_body', ORIGIN_BODY_FALLBACK)}</p>
      <div>
        <Button
          type="button"
          variant="outlined"
          size="small"
          onClick={() => void window.api.shell.openExternal(getHelpDocsLatteUrl(i18n.language))}
        >
          {t('settings.latte_docs_link', '查看完整角色设定')}
        </Button>
      </div>
    </section>
  )
}
