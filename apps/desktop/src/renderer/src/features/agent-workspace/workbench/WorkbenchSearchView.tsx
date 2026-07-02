import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdInsertDriveFile } from 'react-icons/md'
import styles from './WorkbenchSearchView.module.css'

export interface WorkbenchSearchViewProps {
  folderRoot: string | null
  onOpenFile: (relativePath: string) => void
}

async function collectFiles(folderRoot: string, relativePath = ''): Promise<string[]> {
  const entries = await window.api.agentWorkspace.listDir(folderRoot, relativePath || undefined)
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory) {
      const nested = await collectFiles(folderRoot, entry.relativePath)
      files.push(...nested)
    } else {
      files.push(entry.relativePath)
    }
  }
  return files
}

export const WorkbenchSearchView: React.FC<WorkbenchSearchViewProps> = ({
  folderRoot,
  onOpenFile
}) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allFiles.filter((path) => path.toLowerCase().includes(q)).slice(0, 50)
  }, [allFiles, query])

  const handleFocus = () => {
    if (!folderRoot || allFiles.length > 0 || loading) return
    setLoading(true)
    void collectFiles(folderRoot)
      .then(setAllFiles)
      .catch(() => setAllFiles([]))
      .finally(() => setLoading(false))
  }

  return (
    <div className={styles.root}>
      <input
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        placeholder={t('workbench.search_placeholder', '搜索文件名…')}
        disabled={!folderRoot}
      />
      <div className={styles.results}>
        {!folderRoot ? (
          <p className={styles.hint}>{t('agent_workspace.no_folder', '未选择文件夹')}</p>
        ) : loading ? (
          <p className={styles.hint}>{t('common.loading', '加载中…')}</p>
        ) : query.trim() === '' ? (
          <p className={styles.hint}>{t('workbench.search_empty', '输入关键词搜索工作区文件')}</p>
        ) : results.length === 0 ? (
          <p className={styles.hint}>{t('common.no_results', '无结果')}</p>
        ) : (
          <ul className={styles.list}>
            {results.map((path) => (
              <li key={path}>
                <button type="button" className={styles.item} onClick={() => onOpenFile(path)}>
                  <MdInsertDriveFile size={14} />
                  <span>{path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
