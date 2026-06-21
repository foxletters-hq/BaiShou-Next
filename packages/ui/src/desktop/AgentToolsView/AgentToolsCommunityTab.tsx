import React from 'react'
import { useTranslation } from 'react-i18next'
import { Rocket } from 'lucide-react'
import styles from './AgentToolsView.module.css'

export const AgentToolsCommunityTab: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.communityBlank}>
      <Rocket size={56} className={styles.communityIcon} />
      <h4 className={styles.communityTitle}>
        {t('agent.tools.community_market_coming', '插件集市即将上线')}
      </h4>
      <p className={styles.communityDesc}>
        {t(
          'agent.tools.community_coming_soon',
          '不久后，您将能够在这里挂载由其他用户开发的生态能力接口。'
        )}
      </p>
    </div>
  )
}
