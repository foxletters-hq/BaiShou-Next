import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  File,
  ListCollapse,
  Regex,
  Replace,
  Search,
  WholeWord,
  X
} from 'lucide-react'
import { basenameFromPath } from '@baishou/ui'
import { useWorkbenchSearch } from './useWorkbenchSearch'
import { SearchMatchPreview } from './workbench-search-preview'
import styles from './WorkbenchSearchView.module.css'

export interface WorkbenchSearchOpenOptions {
  line?: number
  column?: number
}

export interface WorkbenchSearchViewProps {
  folderRoot: string | null
  onOpenFile: (relativePath: string, options?: WorkbenchSearchOpenOptions) => void
}

function ToggleButton({
  active,
  title,
  onClick,
  children
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.toggleBtn} ${active ? styles.toggleBtnActive : ''}`}
      title={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export const WorkbenchSearchView: React.FC<WorkbenchSearchViewProps> = ({
  folderRoot,
  onOpenFile
}) => {
  const { t } = useTranslation()
  const search = useWorkbenchSearch(folderRoot)
  const { state, patchState, result, loading, replacing, error, summary, collapsedFiles } = search

  const allCollapsed = useMemo(() => {
    if (!result?.files.length) return false
    return result.files.every((file) => collapsedFiles.has(file.relativePath))
  }, [collapsedFiles, result?.files])

  if (!folderRoot) {
    return (
      <div className={styles.root}>
        <p className={styles.hint}>{t('agent_workspace.no_folder', '未选择文件夹')}</p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>{t('workbench.search', '搜索')}</h2>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.iconBtn}
            title={t('workbench.search_clear', '清除搜索')}
            onClick={search.clearSearch}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title={
              allCollapsed
                ? t('workbench.search_expand_all', '展开全部')
                : t('workbench.search_collapse_all', '折叠全部')
            }
            onClick={() => {
              if (!result?.files.length) return
              if (allCollapsed) {
                search.expandAll()
              } else {
                search.collapseAll(result.files)
              }
            }}
          >
            <ListCollapse size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${state.showReplace ? styles.iconBtnActive : ''}`}
            title={t('workbench.search_toggle_replace', '切换替换')}
            aria-pressed={state.showReplace}
            onClick={() => patchState({ showReplace: !state.showReplace })}
          >
            <Replace size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className={styles.form}>
        <div className={styles.inputRow}>
          <Search size={14} strokeWidth={1.75} className={styles.inputIcon} aria-hidden />
          <input
            className={styles.input}
            value={state.pattern}
            onChange={(event) => patchState({ pattern: event.target.value })}
            placeholder={t('workbench.search_in_files', '搜索')}
            spellCheck={false}
          />
          <div className={styles.toggles}>
            <ToggleButton
              active={state.matchCase}
              title={t('workbench.search_match_case', '区分大小写')}
              onClick={() => patchState({ matchCase: !state.matchCase })}
            >
              <CaseSensitive size={14} strokeWidth={1.75} />
            </ToggleButton>
            <ToggleButton
              active={state.matchWholeWord}
              title={t('workbench.search_whole_word', '全字匹配')}
              onClick={() => patchState({ matchWholeWord: !state.matchWholeWord })}
            >
              <WholeWord size={14} strokeWidth={1.75} />
            </ToggleButton>
            <ToggleButton
              active={state.useRegex}
              title={t('workbench.search_regex', '使用正则表达式')}
              onClick={() => patchState({ useRegex: !state.useRegex })}
            >
              <Regex size={14} strokeWidth={1.75} />
            </ToggleButton>
          </div>
        </div>

        {state.showReplace ? (
          <div className={styles.inputRow}>
            <Replace size={14} strokeWidth={1.75} className={styles.inputIcon} aria-hidden />
            <input
              className={styles.input}
              value={state.replace}
              onChange={(event) => patchState({ replace: event.target.value })}
              placeholder={t('workbench.search_replace', '替换')}
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.replaceAllBtn}
              disabled={!state.pattern.trim() || replacing || loading}
              onClick={() => void search.replaceAll()}
            >
              {replacing
                ? t('workbench.search_replacing', '替换中…')
                : t('workbench.search_replace_all', '全部替换')}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={styles.filterToggle}
          onClick={() => patchState({ showFilters: !state.showFilters })}
        >
          {state.showFilters ? (
            <ChevronDown size={14} strokeWidth={1.75} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.75} />
          )}
          <span>{t('workbench.search_files_filter', '要包含的文件')}</span>
        </button>

        {state.showFilters ? (
          <div className={styles.filters}>
            <input
              className={styles.filterInput}
              value={state.includePattern}
              onChange={(event) => patchState({ includePattern: event.target.value })}
              placeholder={t('workbench.search_include_placeholder', '例如 **/*.ts, **/*.md')}
              spellCheck={false}
            />
            <input
              className={styles.filterInput}
              value={state.excludePattern}
              onChange={(event) => patchState({ excludePattern: event.target.value })}
              placeholder={t(
                'workbench.search_exclude_placeholder',
                '排除文件，例如 node_modules, dist'
              )}
              spellCheck={false}
            />
          </div>
        ) : null}
      </div>

      <div className={styles.results}>
        {loading ? (
          <p className={styles.hint}>{t('workbench.search_searching', '正在搜索…')}</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : state.pattern.trim() === '' ? (
          <p className={styles.hint}>
            {t('workbench.search_empty', '输入关键词在工作区文件中搜索')}
          </p>
        ) : !result || result.totalMatches === 0 ? (
          <p className={styles.hint}>{t('workbench.search_no_results', '未找到结果')}</p>
        ) : (
          <>
            <p className={styles.summary}>
              {t('workbench.search_summary', '{{matches}} 个结果，{{files}} 个文件', {
                matches: summary?.matches ?? 0,
                files: summary?.files ?? 0
              })}
              {summary?.truncated
                ? ` · ${t('workbench.search_truncated', '结果已截断')}`
                : ''}
            </p>
            <ul className={styles.fileList}>
              {result.files.map((file) => {
                const collapsed = collapsedFiles.has(file.relativePath)
                return (
                  <li key={file.relativePath} className={styles.fileGroup}>
                    <button
                      type="button"
                      className={styles.fileHeader}
                      onClick={() => search.toggleFileCollapsed(file.relativePath)}
                    >
                      {collapsed ? (
                        <ChevronRight size={14} strokeWidth={1.75} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={1.75} />
                      )}
                      <File size={14} strokeWidth={1.75} className={styles.fileIcon} />
                      <span className={styles.fileName}>{basenameFromPath(file.relativePath)}</span>
                      <span className={styles.filePath}>{file.relativePath}</span>
                      <span className={styles.fileCount}>{file.matches.length}</span>
                    </button>
                    {!collapsed ? (
                      <ul className={styles.matchList}>
                        {file.matches.map((match) => (
                          <li key={`${file.relativePath}:${match.line}:${match.matchStart}`}>
                            <button
                              type="button"
                              className={styles.matchRow}
                              onClick={() =>
                                onOpenFile(file.relativePath, {
                                  line: match.line,
                                  column: match.matchStart
                                })
                              }
                            >
                              <span className={styles.lineNo}>{match.line}</span>
                              <SearchMatchPreview match={match} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
