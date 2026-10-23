import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Input } from '../Input/Input'
import { useToast } from '../Toast/useToast'
import {
  buildIconGallerySections,
  iconGallerySectionLabel,
  type IconGalleryEntry
} from './icon-gallery-catalog'
import styles from './DeveloperIconGallery.module.css'

export type DeveloperIconGalleryProps = {
  onBack: () => void
}

export const DeveloperIconGallery: React.FC<DeveloperIconGalleryProps> = ({ onBack }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [usedOpen, setUsedOpen] = useState(true)
  const [lucideIcons, setLucideIcons] = useState<Record<string, unknown> | null>(null)
  const [resolveIcons, setResolveIcons] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('lucide-react').then((mod) => {
      if (cancelled) return
      const pack = (mod as { icons?: Record<string, unknown> }).icons
      setLucideIcons(pack ?? (mod as Record<string, unknown>))
      setResolveIcons(mod as Record<string, unknown>)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const sections = useMemo(
    () =>
      lucideIcons
        ? buildIconGallerySections({
            lucideIcons,
            resolveIcons: resolveIcons ?? lucideIcons,
            query
          })
        : [],
    [lucideIcons, query, resolveIcons]
  )

  const copyName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name)
    } catch {
      // 复制失败时仍提示名称，方便手抄
    }
    setCopied(name)
    toast.showSuccess(t('developer.icon_copied', '已复制 {{name}}', { name }))
  }

  const renderCard = (item: IconGalleryEntry, hideUsedBadge = false) => {
    const Icon = item.Icon
    return (
      <button
        key={item.name}
        type="button"
        className={`${styles.card} ${copied === item.name ? styles.cardActive : ''}`}
        onClick={() => void copyName(item.name)}
      >
        <Icon className={styles.glyph} size={26} strokeWidth={2} />
        <span className={styles.name}>{item.name}</span>
        {item.used && !hideUsedBadge ? (
          <span className={styles.used}>{t('developer.icon_used_badge', '使用中')}</span>
        ) : null}
      </button>
    )
  }

  return (
    <div className={styles.root}>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} />
        {t('developer.icon_gallery_back', '返回')}
      </button>
      <h2 className={styles.title}>{t('developer.icon_gallery', '图标参考')}</h2>
      <p className={styles.desc}>
        {t(
          'developer.icon_gallery_desc',
          '顶部是软件里已经用到的图标。下面按 lucide 官方分组展示全部图标，与顶部重复的也会保留。点击卡片复制组件名。'
        )}
      </p>
      <Input
        className={styles.search}
        fieldSize="small"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('developer.icon_gallery_search', '搜索图标名或说明')}
        aria-label={t('developer.icon_gallery_search', '搜索图标名或说明')}
      />
      {!lucideIcons ? (
        <p className={styles.empty}>{t('common.loading', '加载中…')}</p>
      ) : sections.every((section) => section.items.length === 0) ? (
        <p className={styles.empty}>{t('developer.icon_gallery_empty', '没有匹配的图标')}</p>
      ) : (
        sections.map((section) => {
          if (section.items.length === 0) return null
          const fallback = iconGallerySectionLabel(section.id)
          const title = t(`developer.icon_cat_${section.id}`, fallback)
          if (section.id === 'used') {
            return (
              <section key={section.id} className={styles.group}>
                <button
                  type="button"
                  className={styles.usedToggle}
                  aria-expanded={usedOpen}
                  onClick={() => setUsedOpen((open) => !open)}
                >
                  <span className={styles.usedToggleLabel}>
                    {title}
                    <span className={styles.count}>{section.items.length}</span>
                  </span>
                  <span className={styles.chevron} aria-hidden>
                    {usedOpen ? '▾' : '▸'}
                  </span>
                </button>
                {usedOpen
                  ? (section.groups ?? []).map((group) => (
                      <div key={group.id} className={styles.usedGroup}>
                        <h4 className={styles.usedGroupTitle}>
                          {t(`developer.icon_cat_${group.id}`, iconGallerySectionLabel(group.id))}
                          <span className={styles.count}>{group.items.length}</span>
                        </h4>
                        <div className={styles.grid}>
                          {group.items.map((item) => renderCard(item, true))}
                        </div>
                      </div>
                    ))
                  : null}
              </section>
            )
          }
          return (
            <section key={section.id} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {title}
                <span className={styles.count}>{section.items.length}</span>
              </h3>
              <div className={styles.grid}>{section.items.map((item) => renderCard(item))}</div>
            </section>
          )
        })
      )}
    </div>
  )
}

export default DeveloperIconGallery
