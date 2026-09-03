import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './InputBar.module.css'
import {
  getInputBarTextareaMinHeight,
  INPUT_BAR_TEXTAREA_MAX_HEIGHT
} from './useInputBarExpand'
import {
  getAtTokenBeforeCaret,
  getSlashTokenBeforeCaret,
  isComposerVisuallyEmpty,
  normalizeEmptyComposer,
  serializeSkillComposer,
  tryDeleteSkillChipByBackspace,
  sanitizeComposerFormatting,
  FILE_REF_CHIP_ATTR,
  readFileRefChip,
  type FileRefChip,
  type MentionToken,
  type SkillRefChip,
  type SlashToken
} from './skill-composer.util'

export type SkillComposerSnapshot = {
  plainText: string
  skills: SkillRefChip[]
  fileRefs: FileRefChip[]
  sendText: string
  slashToken: SlashToken | null
  mentionToken: MentionToken | null
  html: string
}

type Props = {
  editorRef: React.RefObject<HTMLDivElement | null>
  /** 外部写入（草稿恢复 / 发送失败回滚）时递增 */
  syncKey: number
  syncHtml: string | null
  syncPlainText: string
  placeholder?: string
  minRows?: number
  onSnapshot: (snap: SkillComposerSnapshot) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void
  onOpenFileRef?: (relativePath: string, options?: { line?: number }) => void
}

function readSnapshot(root: HTMLElement): SkillComposerSnapshot {
  const serialized = serializeSkillComposer(root)
  return {
    ...serialized,
    slashToken: getSlashTokenBeforeCaret(root),
    mentionToken: getAtTokenBeforeCaret(root),
    html: root.innerHTML
  }
}

export function InputBarSkillEditor({
  editorRef,
  syncKey,
  syncHtml,
  syncPlainText,
  placeholder,
  minRows = 1,
  onSnapshot,
  onKeyDown,
  onPaste,
  onOpenFileRef
}: Props) {
  const minHeight = getInputBarTextareaMinHeight(minRows)
  const lastSyncKeyRef = useRef<number>(-1)
  const composingRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const root = editorRef.current
    if (!root) return
    if (lastSyncKeyRef.current === syncKey) return
    lastSyncKeyRef.current = syncKey
    if (syncHtml != null) {
      root.innerHTML = syncHtml
    } else {
      root.textContent = syncPlainText
    }
    normalizeEmptyComposer(root)
    setIsEmpty(isComposerVisuallyEmpty(root))
    onSnapshot(readSnapshot(root))
  }, [syncKey, syncHtml, syncPlainText, editorRef, onSnapshot])

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.style.height = 'auto'
    const displayHeight = el.scrollHeight
    const nextHeight = Math.max(minHeight, Math.min(displayHeight, INPUT_BAR_TEXTAREA_MAX_HEIGHT))
    el.style.height = `${nextHeight}px`
    el.style.overflowY = displayHeight > INPUT_BAR_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
  })

  const emit = (opts?: { sanitize?: boolean }) => {
    const root = editorRef.current
    if (!root) return
    if (opts?.sanitize !== false && !composingRef.current) {
      sanitizeComposerFormatting(root)
    }
    normalizeEmptyComposer(root)
    setIsEmpty(isComposerVisuallyEmpty(root))
    onSnapshot(readSnapshot(root))
  }

  return (
    <div className={styles.skillEditorWrap} data-empty={isEmpty ? 'true' : 'false'}>
      <div
        ref={editorRef}
        className={`${styles.textarea} ${styles.skillEditor}`}
        contentEditable
        role="textbox"
        aria-multiline="true"
        spellCheck={false}
        data-placeholder={placeholder || ''}
        suppressContentEditableWarning
        onCompositionStart={() => {
          composingRef.current = true
        }}
        onCompositionEnd={() => {
          composingRef.current = false
          emit()
        }}
        onInput={() => emit({ sanitize: !composingRef.current })}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && editorRef.current) {
            if (tryDeleteSkillChipByBackspace(editorRef.current)) {
              e.preventDefault()
              emit()
              return
            }
          }
          onKeyDown(e)
        }}
        onPaste={onPaste}
        onBlur={() => emit()}
        onMouseDown={(event) => {
          const target = event.target
          if (!(target instanceof Element)) return
          const chip = target.closest(`[${FILE_REF_CHIP_ATTR}]`)
          if (chip && editorRef.current?.contains(chip)) {
            event.preventDefault()
          }
        }}
        onClick={(event) => {
          if (!onOpenFileRef) return
          const target = event.target
          if (!(target instanceof Element)) return
          const chip = target.closest(`[${FILE_REF_CHIP_ATTR}]`)
          if (!chip || !editorRef.current?.contains(chip)) return
          event.preventDefault()
          event.stopPropagation()
          const ref = readFileRefChip(chip as HTMLElement)
          if (!ref.relativePath) return
          onOpenFileRef(ref.relativePath, {
            line: ref.selection?.startLine
          })
        }}
      />
    </div>
  )
}
