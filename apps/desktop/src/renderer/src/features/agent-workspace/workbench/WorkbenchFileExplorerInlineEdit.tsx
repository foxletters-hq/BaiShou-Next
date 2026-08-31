import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Folder } from 'lucide-react'
import { getFileTypeIcon } from '@baishou/ui'
import { selectNameRange, validateTreeEntryName } from './workbench-inline-name.util'
import { workbenchTreeTwistieOffset } from './workbench-file-tree.util'
import styles from './WorkbenchFileExplorer.module.css'

export type InlineTreeEditState =
  | {
      mode: 'create'
      parentDir: string
      kind: 'file' | 'folder'
      initialName: string
    }
  | {
      mode: 'rename'
      relativePath: string
      isDirectory: boolean
      initialName: string
    }

export interface InlineTreeNameRowProps {
  depth: number
  isDirectory: boolean
  initialName: string
  existingNames: string[]
  ignoreName?: string
  onCommit: (name: string) => void
  onCancel: () => void
  /** 嵌入已有树行内（重命名），不额外包一层 row */
  embedded?: boolean
}

export const InlineTreeNameRow: React.FC<InlineTreeNameRowProps> = ({
  depth,
  isDirectory,
  initialName,
  existingNames,
  ignoreName,
  onCommit,
  onCancel,
  embedded = false
}) => {
  const [value, setValue] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  const validationError = useMemo(
    () =>
      validateTreeEntryName(value, existingNames, {
        ignoreName,
        isDirectory
      }),
    [existingNames, ignoreName, isDirectory, value]
  )

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const { start, end } = selectNameRange(initialName, isDirectory)
    input.setSelectionRange(start, end)
  }, [initialName, isDirectory])

  const commit = (allowInvalidBlur = false) => {
    if (committedRef.current) return
    const trimmed = value.trim()
    if (!trimmed) {
      committedRef.current = true
      onCancel()
      return
    }
    if (validationError) {
      if (allowInvalidBlur) {
        committedRef.current = true
        onCancel()
      }
      return
    }
    committedRef.current = true
    onCommit(trimmed)
  }

  const cancel = () => {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }

  const renderInput = () => (
    <>
      <input
        ref={inputRef}
        className={`${styles.inlineInput} ${validationError ? styles.inlineInputInvalid : ''}`}
        value={value}
        aria-invalid={validationError ? true : undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(false)
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
        onBlur={() => commit(true)}
      />
      {validationError ? <span className={styles.inlineError}>{validationError}</span> : null}
    </>
  )

  const entryIcon = (
    <span className={styles.rowIcon}>
      {isDirectory ? (
        <Folder size={16} strokeWidth={1.75} />
      ) : (
        getFileTypeIcon(value.trim() || initialName, 16)
      )}
    </span>
  )

  if (embedded) {
    return (
      <span className={styles.nameBtn} onMouseDown={(event) => event.stopPropagation()}>
        {entryIcon}
        {renderInput()}
      </span>
    )
  }

  return (
    <div
      className={`${styles.row} ${styles.rowEditing}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {depth > 0 ? (
        <span className={styles.indentGuides} aria-hidden>
          {Array.from({ length: depth }, (_, index) => (
            <span key={index} className={styles.indentGuide} />
          ))}
        </span>
      ) : null}
      <span className={styles.twistie} style={{ marginLeft: workbenchTreeTwistieOffset(depth) }} />
      <span className={styles.nameBtn}>
        {entryIcon}
        {renderInput()}
      </span>
    </div>
  )
}
