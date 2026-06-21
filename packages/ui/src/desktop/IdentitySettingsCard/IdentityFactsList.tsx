import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  MdOutlinePersonAddAlt1,
  MdOutlineLabel,
  MdOutlineEdit,
  MdOutlineDeleteOutline,
  MdAdd
} from 'react-icons/md'
import styles from './IdentitySettingsCard.module.css'

interface IdentityFactsListProps {
  currentFacts: Record<string, string>
  onAddFact: () => void
  onEditFact: (key: string, value: string) => void
  onDeleteFact: (key: string) => void
}

export const IdentityFactsList: React.FC<IdentityFactsListProps> = ({
  currentFacts,
  onAddFact,
  onEditFact,
  onDeleteFact
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.factsContainer}>
      <div className={styles.factsHeader}>
        <span className={styles.factsHeaderTitle}>
          {t('settings.identity_facts_title', '身份条目')}
        </span>
        <button className={styles.addFactButton} onClick={onAddFact}>
          <MdAdd size={16} />
          {t('settings.add_identity_entry', '添加条目')}
        </button>
      </div>

      {Object.keys(currentFacts).length === 0 ? (
        <div className={styles.emptyContainer}>
          <MdOutlinePersonAddAlt1 size={32} />
          <span>{t('settings.identity_card_empty_hint')}</span>
        </div>
      ) : (
        <div className={styles.factsList}>
          {Object.entries(currentFacts).map(([k, v]) => (
            <div key={k} className={styles.factListTile}>
              <div className={styles.factLeading}>
                <MdOutlineLabel size={18} className={styles.primaryIcon} />
              </div>

              <div className={styles.factContent}>
                <span className={styles.factKey}>{k}</span>
                <span className={styles.factValue}>{v}</span>
              </div>

              <div className={styles.factTrailing}>
                <button className={styles.iconIconButton} onClick={() => onEditFact(k, v)}>
                  <MdOutlineEdit size={16} />
                </button>
                <button
                  className={`${styles.iconIconButton} ${styles.dangerIcon}`}
                  onClick={() => onDeleteFact(k)}
                >
                  <MdOutlineDeleteOutline size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
