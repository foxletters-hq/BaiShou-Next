import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveUserSkillDisplay, type SkillCiteRef } from '@baishou/shared'
import { SkillCitePreviewDialog } from './SkillCitePreviewDialog'
import styles from './UserMessageSkillContent.module.css'

type Props = {
  text: string
  skillRefs?: SkillCiteRef[] | null
  className?: string
}

export function UserMessageSkillContent({ text, skillRefs, className }: Props) {
  const { t } = useTranslation()
  const resolved = useMemo(() => resolveUserSkillDisplay(text, skillRefs), [text, skillRefs])
  const [preview, setPreview] = useState<SkillCiteRef | null>(null)

  if (!resolved.text && resolved.segments.length === 0) return null

  const hasSkill = resolved.segments.some((seg) => seg.type === 'skill')
  if (!hasSkill) {
    return <div className={className}>{resolved.text}</div>
  }

  return (
    <>
      <div className={className}>
        {resolved.segments.map((seg, index) => {
          if (seg.type === 'text') {
            return <React.Fragment key={`t-${index}`}>{seg.value}</React.Fragment>
          }
          return (
            <button
              key={`s-${index}-${seg.command}`}
              type="button"
              className={styles.skillCite}
              title={t('shortcut.view_skill', '查看 Skill')}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setPreview({ command: seg.command, content: seg.content })
              }}
            >
              /{seg.command}
            </button>
          )
        })}
      </div>
      <SkillCitePreviewDialog
        open={Boolean(preview)}
        command={preview?.command ?? ''}
        content={preview?.content ?? ''}
        onClose={() => setPreview(null)}
      />
    </>
  )
}
