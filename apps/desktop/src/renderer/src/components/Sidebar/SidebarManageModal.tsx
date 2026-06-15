import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@baishou/ui'
import { MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md'
import {
  SIDEBAR_NAV_GROUPS,
  SIDEBAR_NAV_ICON_SIZE,
  buildSidebarNavItems,
  type SidebarNavId
} from './sidebar-nav-catalog'
import styles from './SidebarManageModal.module.css'

interface SidebarManageModalProps {
  isOpen: boolean
  hiddenItems: string[]
  onClose: () => void
  onToggle: (id: SidebarNavId) => void
}

export const SidebarManageModal: React.FC<SidebarManageModalProps> = ({
  isOpen,
  hiddenItems,
  onClose,
  onToggle
}) => {
  const { t } = useTranslation()
  const allItems = buildSidebarNavItems(t)
  const hiddenSet = new Set(hiddenItems)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick
      title={t('sidebar.manage_title', '自定义侧边栏')}
      className={styles.modal}
      zIndex={1200}
    >
      <div className={styles.modalContent}>
        <div className={styles.scrollArea}>
          <p className={styles.hint}>
            {t(
              'sidebar.manage_hint',
              '勾选要固定在日记区左侧的入口，分组与系统设置一致。未勾选的项仍可通过底部「设置」访问。'
            )}
          </p>
          <div className={styles.groupList}>
            {SIDEBAR_NAV_GROUPS.map((group) => (
              <section key={group.key} className={styles.group}>
                <h3 className={styles.groupTitle}>{t(group.labelKey, group.defaultLabel)}</h3>
                <div className={styles.optionGrid}>
                  {group.itemIds.map((id) => {
                    const item = allItems[id]
                    if (!item) return null
                    const visible = !hiddenSet.has(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.option} ${visible ? styles.optionActive : ''}`}
                        onClick={() => onToggle(id)}
                      >
                        <span className={styles.checkbox} aria-hidden="true">
                          {visible ? (
                            <MdCheckBox size={SIDEBAR_NAV_ICON_SIZE} />
                          ) : (
                            <MdCheckBoxOutlineBlank size={SIDEBAR_NAV_ICON_SIZE} />
                          )}
                        </span>
                        <span className={styles.optionIcon}>{item.icon}</span>
                        <span className={styles.optionLabel}>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            {t('common.done', '完成')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
