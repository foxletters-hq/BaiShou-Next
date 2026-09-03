import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatFileMentionLabel,
  resolveUserComposerCites,
  type FileCiteRef,
  type SkillCiteRef
} from '@baishou/shared'
import { SkillCitePreviewDialog } from './SkillCitePreviewDialog'
import styles from './UserMessageSkillContent.module.css'

type Props = {
  text: string
  skillRefs?: SkillCiteRef[] | null
  fileRefs?: FileCiteRef[] | null
  className?: string
  onOpenFile?: (relativePath: string, options?: { line?: number }) => void
}

export function UserMessageSkillContent({
  text,
  skillRefs,
  fileRefs,
  className,
  onOpenFile
}: Props) {
  const { t } = useTranslation()
  const resolved = useMemo(
    () => resolveUserComposerCites(text, skillRefs, fileRefs),
    [fileRefs, skillRefs, text]
  )
  const [preview, setPreview] = useState<SkillCiteRef | null>(null)

  if (resolved.segments.length === 0) return null

  if (!resolved.hasCite) {
    return <div className={className}>{text}</div>
  }

  return (
    <>
      <div className={className}>
        {resolved.segments.map((seg, index) => {
          if (seg.type === 'text') {
            return <React.Fragment key={`t-${index}`}>{seg.value}</React.Fragment>
          }
          if (seg.type === 'skill') {
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
          }
          const label = formatFileMentionLabel(seg)
          const title = seg.comment?.trim()
            ? `${seg.relativePath}\n${seg.comment.trim()}`
            : seg.relativePath
          if (!onOpenFile) {
            return (
              <span
                key={`f-${index}-${seg.relativePath}`}
                className={styles.skillCite}
                title={title}
              >
                {label}
              </span>
            )
          }
          return (
            <button
              key={`f-${index}-${seg.relativePath}`}
              type="button"
              className={styles.skillCite}
              title={title}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenFile(seg.relativePath, { line: seg.selection?.startLine })
              }}
            >
              {label}
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
