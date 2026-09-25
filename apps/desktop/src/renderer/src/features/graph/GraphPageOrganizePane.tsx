import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_CONCURRENCY_MIN,
  USER_GENDER_OPTIONS,
  type UserGender
} from '@baishou/shared'
import { Button, HelpTooltip, Input, Select } from '@baishou/ui'
import { GraphAwakenBirthdayField } from './GraphAwakenBirthdayField'
import { GraphExtractHelpButton } from './GraphExtractHelpButton'
import styles from './GraphPage.module.css'

export function GraphPageOrganizePane(props: {
  profileSectionOpen: boolean
  onToggleProfileSection: () => void
  profileForm: { nickname: string; birthday: string; gender: UserGender | '' }
  onProfileFormChange: (
    patch: Partial<{ nickname: string; birthday: string; gender: UserGender | '' }>
  ) => void
  profileBusy: boolean
  profileErrors: { nickname?: boolean; birthday?: boolean; gender?: boolean }
  onSaveProfile: () => void
  pendingReextractCount: number
  onRunExtract: () => void
  extractRunning: boolean
  onOpenQueue: () => void
  extractConcurrency: number
  onExtractConcurrencyChange: (value: string) => void
  extractDate: string
  onExtractDateChange: (value: string) => void
  busy: boolean
  onRunExtractOne: () => void
  mergeSearchOpen: boolean
  onOpenCreate: () => void
  onToggleMerge: () => void
  onClearLifeGraph: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const [dataSectionOpen, setDataSectionOpen] = useState(false)
  return (
    <>
      <div className={styles.settingsHeader}>
        <div className={styles.settingsTitle}>{t('graph.side_organize', '整理')}</div>
      </div>
      <div className={styles.panel} data-graph-side-scroll>
        <div className={styles.settingsSection}>
          <button
            type="button"
            className={styles.settingsSectionHead}
            onClick={props.onToggleProfileSection}
          >
            <span className={styles.settingsChevron}>{props.profileSectionOpen ? '▾' : '▸'}</span>
            {t('graph.profile_section', '身份资料')}
          </button>
          {props.profileSectionOpen ? (
            <div className={styles.settingsSectionBody}>
              <p className={styles.profileHint}>
                {t(
                  'graph.profile_hint',
                  '用于识别日记中的「我」。修改昵称会同步更新图谱中的自称节点，旧昵称保留为别名，无需重建整图。'
                )}
              </p>
              <div className={styles.profileFields}>
                <label className={styles.profileField}>
                  <span>{t('graph.awaken_nickname_label', '昵称')}</span>
                  <Input
                    fieldSize="small"
                    value={props.profileForm.nickname}
                    onChange={(e) => props.onProfileFormChange({ nickname: e.target.value })}
                    placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
                    disabled={props.profileBusy}
                  />
                  {props.profileErrors.nickname ? (
                    <span className={styles.profileError}>
                      {t('graph.awaken_nickname_required', '请填写昵称')}
                    </span>
                  ) : null}
                </label>
                <div className={styles.profileField}>
                  <span>{t('graph.awaken_birthday_label', '生日')}</span>
                  <GraphAwakenBirthdayField
                    value={props.profileForm.birthday}
                    onChange={(birthday) => props.onProfileFormChange({ birthday })}
                    disabled={props.profileBusy}
                    hasError={!!props.profileErrors.birthday}
                  />
                  {props.profileErrors.birthday ? (
                    <span className={styles.profileError}>
                      {t('graph.awaken_birthday_required', '请选择生日')}
                    </span>
                  ) : null}
                </div>
                <div className={styles.profileField}>
                  <span>{t('graph.awaken_gender_label', '性别')}</span>
                  <div className={styles.genderRow} role="radiogroup">
                    {USER_GENDER_OPTIONS.map((g) => {
                      const label =
                        g === 'male'
                          ? t('graph.awaken_gender_male', '男')
                          : g === 'female'
                            ? t('graph.awaken_gender_female', '女')
                            : g === 'other'
                              ? t('graph.awaken_gender_other', '其他')
                              : t('graph.awaken_gender_unspecified', '不愿透露')
                      return (
                        <button
                          key={g}
                          type="button"
                          role="radio"
                          aria-checked={props.profileForm.gender === g}
                          className={
                            props.profileForm.gender === g
                              ? styles.genderChipActive
                              : styles.genderChip
                          }
                          disabled={props.profileBusy}
                          onClick={() => props.onProfileFormChange({ gender: g })}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {props.profileErrors.gender ? (
                    <span className={styles.profileError}>
                      {t('graph.awaken_gender_required', '请选择性别')}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  disabled={props.profileBusy}
                  onClick={() => void props.onSaveProfile()}
                >
                  {t('graph.profile_save', '保存身份资料')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.opsBlock}>
          <Button
            type="button"
            disabled={props.pendingReextractCount === 0}
            title={t('graph.process_pending_reextract_hint', '把当前待重抽日记加入整理队列')}
            onClick={() => void props.onRunExtract()}
          >
            {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
              count: props.pendingReextractCount
            })}
          </Button>
          {props.extractRunning ? (
            <Button type="button" onClick={props.onOpenQueue}>
              {t('graph.queue_view_progress', '查看进度')}
            </Button>
          ) : null}
          <div className={styles.opsConcurrency}>
            <div className={styles.opsLabelRow}>
              <span className={styles.viewFieldLabel}>
                {t('graph.extract_concurrency', '同时抽取')}
              </span>
              <GraphExtractHelpButton size={14} />
            </div>
            <Select
              size="small"
              value={String(props.extractConcurrency)}
              onChange={(e) => props.onExtractConcurrencyChange(e.target.value)}
              options={Array.from(
                {
                  length: GRAPH_EXTRACT_CONCURRENCY_MAX - GRAPH_EXTRACT_CONCURRENCY_MIN + 1
                },
                (_, i) => {
                  const n = GRAPH_EXTRACT_CONCURRENCY_MIN + i
                  return { value: String(n), label: String(n) }
                }
              )}
            />
          </div>
        </div>

        <div className={styles.opsBlock}>
          <div className={styles.opsLabelRow}>
            <span className={styles.viewFieldLabel}>{t('graph.extract_one_date', '日记日期')}</span>
            <HelpTooltip
              content={t(
                'graph.extract_one_hint',
                '选一篇已有日记，强制加入整理队列。系统写出的关系会被这次结果替换；你手改过的边会留下。'
              )}
            />
          </div>
          <input
            type="date"
            className={styles.opsDateInput}
            value={props.extractDate}
            onChange={(event) => props.onExtractDateChange(event.target.value)}
          />
          <Button type="button" disabled={props.busy} onClick={() => void props.onRunExtractOne()}>
            {t('graph.extract_one_action', '重新梳理这篇')}
          </Button>
        </div>

        <div className={styles.opsBlock}>
          <div className={styles.viewFieldLabel}>{t('graph.ops_nodes', '节点')}</div>
          <div className={styles.opsBtnRow}>
            <Button type="button" disabled={props.busy} onClick={props.onOpenCreate}>
              {t('graph.create_node', '新建节点')}
            </Button>
            <Button
              type="button"
              className={props.mergeSearchOpen ? styles.btnActive : ''}
              disabled={props.busy}
              onClick={props.onToggleMerge}
            >
              {t('graph.merge_nodes', '合并节点')}
            </Button>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <button
            type="button"
            className={styles.settingsSectionHead}
            onClick={() => setDataSectionOpen((open) => !open)}
          >
            <span className={styles.settingsChevron}>{dataSectionOpen ? '▾' : '▸'}</span>
            {t('graph.data_ops', '数据操作')}
          </button>
          {dataSectionOpen ? (
            <div className={styles.settingsSectionBody}>
              <div className={styles.opsLabelRow}>
                <span className={styles.viewFieldLabel}>
                  {t('graph.clear_life_title', '清空人生关系图')}
                </span>
                <HelpTooltip
                  content={t(
                    'graph.clear_life_hint',
                    '删除本工作区人生关系图的全部节点、连线和抽取记录。笔记本关系图不会被改动。'
                  )}
                />
              </div>
              <Button
                type="button"
                disabled={props.busy}
                onClick={() => void props.onClearLifeGraph()}
              >
                {t('graph.clear_life_action', '清空人生关系图')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
