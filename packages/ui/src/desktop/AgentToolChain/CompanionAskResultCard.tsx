import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  CompanionAskItemView,
  CompanionAskOptionView,
  CompanionAskPresentation
} from '../../shared/tool-result.util'
import styles from './CompanionAskResultCard.module.css'

function CompanionAskResultItem({
  question,
  answer,
  declined,
  options,
  selectedOptionIds
}: {
  question: string
  answer: string | null
  declined: boolean
  options: CompanionAskOptionView[]
  selectedOptionIds: string[]
}) {
  const { t } = useTranslation()
  const selected = new Set(selectedOptionIds)
  const showOptions = !declined && options.length > 0

  return (
    <div className={styles.questionBlock}>
      {question ? <p className={styles.question}>{question}</p> : null}
      {declined ? (
        <p className={styles.status}>{t('agent.tools.companion_ask_declined', '没有作答')}</p>
      ) : null}
      {showOptions ? (
        <div className={styles.options} role="list">
          {options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === answer
            return (
              <div
                key={option.id}
                role="listitem"
                className={`${styles.option}${isSelected ? ` ${styles.optionSelected}` : ''}`}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={
                  isSelected
                    ? `${t('agent.tools.companion_ask_selected', '已选择')}：${option.label}`
                    : option.label
                }
              >
                {option.label}
              </div>
            )
          })}
        </div>
      ) : null}
      {!declined && !showOptions && answer ? (
        <div className={styles.options} role="list">
          <div
            role="listitem"
            className={`${styles.option} ${styles.optionSelected}`}
            aria-current="true"
          >
            {answer}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PagedCompanionAskResults({
  items,
  declined
}: {
  items: CompanionAskItemView[]
  declined: boolean
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const safeIndex = Math.min(index, Math.max(items.length - 1, 0))
  const item = items[safeIndex]
  if (!item) return null

  return (
    <>
      <CompanionAskResultItem
        question={item.question}
        answer={item.answer}
        declined={declined}
        options={item.options}
        selectedOptionIds={item.selectedOptionIds}
      />
      <div className={styles.pager}>
        <button
          type="button"
          className={styles.pagerBtn}
          disabled={safeIndex <= 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          aria-label={t('agent_gate.queue_prev', '上一题')}
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden />
        </button>
        <p className={styles.pagerProgress}>
          {t('agent_gate.ask_progress', '{{current}} / {{total}}', {
            current: safeIndex + 1,
            total: items.length
          })}
        </p>
        <button
          type="button"
          className={styles.pagerBtn}
          disabled={safeIndex >= items.length - 1}
          onClick={() => setIndex((current) => Math.min(items.length - 1, current + 1))}
          aria-label={t('agent_gate.queue_next', '下一题')}
        >
          <ChevronRight size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </>
  )
}

/** 已作答的提问结果，只出现在折叠工具行展开后。多题时一题一页。 */
export function CompanionAskResultCard({ data }: { data: CompanionAskPresentation }) {
  const { t } = useTranslation()
  const items = data.items && data.items.length > 1 ? data.items : null

  return (
    <section className={styles.card} aria-label={t('agent.tools.companion_ask', '伙伴提问')}>
      <p className={styles.label}>{t('agent.tools.companion_ask_card_label', '提问')}</p>
      {items ? (
        <PagedCompanionAskResults items={items} declined={data.declined} />
      ) : (
        <CompanionAskResultItem
          question={data.question}
          answer={data.answer}
          declined={data.declined}
          options={data.options}
          selectedOptionIds={data.selectedOptionIds}
        />
      )}
    </section>
  )
}
