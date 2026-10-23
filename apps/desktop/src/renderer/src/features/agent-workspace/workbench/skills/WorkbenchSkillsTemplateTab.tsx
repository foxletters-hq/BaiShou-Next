import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '@baishou/ui'
import { WORKBENCH_SKILL_CARDS } from './workbench-skill-catalog'
import styles from './WorkbenchSkillsPage.module.css'

export function WorkbenchSkillsTemplateTab({
  query,
  onQueryChange,
  launching,
  visibleTemplates,
  onUseTemplate
}: {
  query: string
  onQueryChange: (value: string) => void
  launching: boolean
  visibleTemplates: typeof WORKBENCH_SKILL_CARDS
  onUseTemplate: (card: (typeof WORKBENCH_SKILL_CARDS)[number]) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <header className={styles.hero}>
        <h1 className={styles.title}>{t('workbench.templates_title', '模板')}</h1>
        <p className={styles.subtitle}>
          {t('workbench.templates_subtitle', '用模板快速创建一个项目空间')}
        </p>
      </header>

      <label className={styles.search}>
        <Search className={styles.searchIcon} size={16} strokeWidth={2} aria-hidden />
        <Input
          fieldSize="small"
          type="search"
          inputClassName={styles.searchInput}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('workbench.templates_search', '搜索模板')}
          aria-label={t('workbench.templates_search', '搜索模板')}
        />
      </label>

      {visibleTemplates.length === 0 ? (
        <p className={styles.empty}>{t('workbench.templates_empty', '没有匹配的模板')}</p>
      ) : (
        <div className={styles.grid}>
          {visibleTemplates.map((card) => (
            <div key={card.name} className={styles.card}>
              <button
                type="button"
                className={styles.cardMain}
                disabled={launching}
                onClick={() => onUseTemplate(card)}
              >
                <span className={styles.cover}>
                  <img src={card.image} alt="" />
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{t(card.titleKey)}</span>
                  <span className={styles.cardDesc}>{t(card.descriptionKey)}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
