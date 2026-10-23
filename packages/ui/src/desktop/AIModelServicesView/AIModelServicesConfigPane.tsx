import React, { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Key, Link, List, Search, Trash2 } from 'lucide-react'
import { isDeepSeekOfficialProvider } from '@baishou/shared'
import { Button } from '../Button/Button'
import { Input } from '../Input/Input'
import { Switch } from '../Switch/Switch'
import { HelpTooltip } from '../HelpTooltip'
import { ModelVisionBadge } from '../../shared/ModelVisionBadge'
import type { AIModelServicesViewModel } from './useAIModelServicesView'
import styles from './AIModelServicesView.module.css'

export interface AIModelServicesConfigPaneProps {
  vm: AIModelServicesViewModel
}

export const AIModelServicesConfigPane: React.FC<AIModelServicesConfigPaneProps> = ({ vm }) => {
  const [modelSearchQuery, setModelSearchQuery] = useState('')

  const {
    t,
    activeProviderMeta,
    activeConfig,
    renderIcon,
    handleToggleEnable,
    handleDeleteProvider,
    handleResetCurrentProvider,
    localFormData,
    setLocalFormData,
    handleBaseUrlBlur,
    isObscure,
    setIsObscure,
    handleTestConnection,
    isTesting,
    handleFetchModels,
    isFetchingModels,
    delayedEnabledModels,
    handleModelToggle,
    handleSaveCurrentProviderConfig
  } = vm

  useEffect(() => {
    setModelSearchQuery('')
  }, [activeProviderMeta?.id])

  const sortedDisplayModels = useMemo(() => {
    const models = activeConfig?.models
    if (!models?.length) return []

    const sortingSet = new Set(delayedEnabledModels)
    const enabledModels = models.filter((m) => sortingSet.has(m))
    const disabledModels = models.filter((m) => !sortingSet.has(m))
    const sorted = [...enabledModels, ...disabledModels]

    const query = modelSearchQuery.trim().toLowerCase()
    if (!query) return sorted
    return sorted.filter((m) => m.toLowerCase().includes(query))
  }, [activeConfig?.models, delayedEnabledModels, modelSearchQuery])

  if (!activeProviderMeta) return null

  return (
    <div className={styles.rightPane}>
      <div className={styles.rightContentMask}>
        <div className={styles.rightContentScroll}>
          <div className={styles.configHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.hugeIconBox}>{renderIcon(activeProviderMeta.iconUrl)}</div>
              <div className={styles.headerTextCol}>
                <div className={styles.headerTitleRow}>
                  <h2 className={styles.headerTitle}>{activeProviderMeta.name}</h2>
                  {isDeepSeekOfficialProvider(activeProviderMeta.id) ? (
                    <HelpTooltip
                      content={t(
                        'ai_config.deepseek_peak_pricing_help',
                        '本地费用估算根据 DeepSeek 官方规则按调用时段区分计费：\n\n• 高峰时段（按平时 2 倍估算）：工作日 9:00–12:00、14:00–18:00（北京时间）\n• 空闲时段（正常单价）：工作日其余时段、周末及法定节假日\n\n注：仅用于本地成本估算参考，实际扣费以 DeepSeek 控制台账单为准。'
                      )}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Switch size="sm" checked={activeConfig.enabled} onChange={handleToggleEnable} />
              {!activeProviderMeta.isSystem && (
                <button
                  className={styles.deleteButton}
                  onClick={handleDeleteProvider}
                  title={t('agent.provider.delete_tooltip', '删除供应商')}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>

          {/* ProviderConfigForm Box */}
          <div className={styles.formCard}>
            <div className={styles.formHeaderRow}>
              <div className={styles.formHeaderTitle}>
                <span>{t('settings.api_config', 'API 配置')}</span>
                <HelpTooltip
                  content={t(
                    'ai_config.test_connection_help',
                    '系统将发送测试文本以验证 API 服务的连通性与密钥有效性。\n\n• 测试模型：请选择「文本对话模型」（不支持 Embedding、Rerank 或 TTS 语音模型）\n• 列表为空：若暂无可用模型，请先点击「获取模型」并启用至少一个对话模型'
                  )}
                  size={14}
                />
              </div>
              <Button variant="outlined" size="small" onClick={handleResetCurrentProvider}>
                {t('settings.reset_default', '恢复默认')}
              </Button>
            </div>

            <div className={styles.inputGroup}>
              <Input
                type="text"
                value={localFormData.baseUrl}
                onChange={(e) =>
                  setLocalFormData({
                    ...localFormData,
                    baseUrl: e.target.value
                  })
                }
                onBlur={handleBaseUrlBlur}
                placeholder={activeProviderMeta.defaultBase || 'API Base URL'}
                leading={<Link size={16} aria-hidden />}
              />
            </div>

            <div className={styles.inputGroup}>
              <Input
                type={isObscure ? 'password' : 'text'}
                value={localFormData.apiKey}
                onChange={(e) =>
                  setLocalFormData({
                    ...localFormData,
                    apiKey: e.target.value
                  })
                }
                placeholder={t('ai_config.api_key_placeholder', 'API Key')}
                leading={<Key size={16} aria-hidden />}
                trailing={
                  <button
                    type="button"
                    className={styles.revealButton}
                    onClick={() => setIsObscure(!isObscure)}
                  >
                    {isObscure ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            </div>

            <Button
              variant="outlined"
              size="small"
              className={styles.fullWidthButton}
              onClick={handleTestConnection}
              isLoading={isTesting}
            >
              {isTesting
                ? t('settings.testing_connection', '正在测试连接...')
                : t('settings.test_connection', '测试连接')}
            </Button>
          </div>

          {/* ProviderModelList Section */}
          <div className={styles.modelListSection}>
            <div className={styles.modelListHeader}>
              <div className={styles.modelListTitleBox}>
                <List size={16} className={styles.modelListTitleIcon} />
                <span className={styles.modelListTitle}>
                  {t('settings.model_list_count', '模型列表 ($enabled / $total)')
                    .replace('$enabled', String(activeConfig.enabledModels?.length || 0))
                    .replace('$total', String(activeConfig.models?.length || 0))}
                </span>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={handleFetchModels}
                isLoading={isFetchingModels}
              >
                {t('settings.fetch_models', '获取模型')}
              </Button>
            </div>

            {activeConfig.models && activeConfig.models.length > 0 ? (
              <>
                <div className={styles.modelSearchWrap}>
                  <Input
                    type="search"
                    fieldSize="small"
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    placeholder={t('common.search_model', '搜索模型...')}
                    leading={<Search size={16} aria-hidden />}
                    aria-label={t('common.search_model', '搜索模型...')}
                  />
                </div>

                {sortedDisplayModels.length > 0 ? (
                  <div className={styles.modelsCard}>
                    {(() => {
                      const actualEnabledSet = new Set(activeConfig.enabledModels || [])

                      return sortedDisplayModels.map((mdl, idx) => {
                        const isChecked = actualEnabledSet.has(mdl)
                        const isLast = idx === sortedDisplayModels.length - 1
                        return (
                          <div
                            key={mdl}
                            className={`${styles.modelLineItem} ${!isLast ? styles.modelLineItemDivider : ''}`}
                          >
                            <div className={styles.modelLineItemLeft}>
                              {renderIcon(activeProviderMeta.iconUrl)}
                              <span
                                className={`${styles.modelNameText} ${isChecked ? styles.modelNameChecked : ''}`}
                              >
                                {mdl}
                                <ModelVisionBadge
                                  modelId={mdl}
                                  providerKey={vm.selectedProviderId}
                                />
                              </span>
                            </div>
                            <Switch
                              size="sm"
                              checked={isChecked}
                              onChange={(e) => handleModelToggle(mdl, e.target.checked)}
                            />
                          </div>
                        )
                      })
                    })()}
                  </div>
                ) : (
                  <div className={styles.emptyModelsCard}>
                    <Search size={24} className={styles.emptyModelsIcon} />
                    <span>{t('common.no_match_model', '没有匹配的可用模型')}</span>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyModelsCard}>
                <List size={24} className={styles.emptyModelsIcon} />
                <span>{t('settings.no_models_hint', '暂无模型，点击右上角按钮获取')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.bottomBarArea}>
        <div className={styles.bottomBarContainer}>
          <Button variant="outlined" size="small" onClick={handleSaveCurrentProviderConfig}>
            {t('ai_config.save_changes_button', '保存修改')}
          </Button>
        </div>
      </div>
    </div>
  )
}
