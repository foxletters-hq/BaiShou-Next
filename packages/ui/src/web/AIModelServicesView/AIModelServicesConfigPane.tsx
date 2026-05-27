import React from 'react'
import {
  MdApi,
  MdRestore,
  MdLink,
  MdVpnKey,
  MdVisibility,
  MdVisibilityOff,
  MdViewList,
  MdSync,
  MdDeleteOutline
} from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import { Switch } from '../Switch/Switch'
import type { AIModelServicesViewModel } from './useAIModelServicesView'

export interface AIModelServicesConfigPaneProps {
  vm: AIModelServicesViewModel
}

export const AIModelServicesConfigPane: React.FC<AIModelServicesConfigPaneProps> = ({ vm }) => {
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

  if (!activeProviderMeta) return null

  return (
    <div className={styles.rightPane}>
      <div className={styles.rightContentMask}>
        <div className={styles.rightContentScroll}>
          <div className={styles.configHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.hugeIconBox}>{renderIcon(activeProviderMeta.iconUrl)}</div>
              <div className={styles.headerTextCol}>
                <h2 className={styles.headerTitle}>{activeProviderMeta.name}</h2>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Switch checked={activeConfig.enabled} onChange={handleToggleEnable} />
              {!activeProviderMeta.isSystem && (
                <button
                  className={styles.deleteButton}
                  onClick={handleDeleteProvider}
                  title={t('agent.provider.delete_tooltip', '删除供应商')}
                >
                  <MdDeleteOutline size={22} />
                </button>
              )}
            </div>
          </div>

          {/* ProviderConfigForm Box */}
          <div className={styles.formCard}>
            <div className={styles.formHeaderRow}>
              <div className={styles.formHeaderTitle}>
                <div className={styles.apiIconBox}>
                  <MdApi className={styles.apiIcon} />
                </div>
                <span>{t('settings.api_config', 'API 配置')}</span>
              </div>
              <button className={styles.resetBtnInline} onClick={handleResetCurrentProvider}>
                <MdRestore size={16} />
                <span>{t('settings.reset_default', '恢复默认')}</span>
              </button>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.inputContainer}>
                <MdLink className={styles.inputPrefixIcon} />
                <input
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
                  className={styles.textFieldWithIcon}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.inputContainer}>
                <MdVpnKey className={styles.inputPrefixIcon} />
                <input
                  type={isObscure ? 'password' : 'text'}
                  value={localFormData.apiKey}
                  onChange={(e) =>
                    setLocalFormData({
                      ...localFormData,
                      apiKey: e.target.value
                    })
                  }
                  placeholder={t('ai_config.api_key_placeholder', 'API Key')}
                  className={styles.textFieldWithIcon}
                />
                <button className={styles.revealButton} onClick={() => setIsObscure(!isObscure)}>
                  {isObscure ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button
              className={styles.testBtnBlock}
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting && <span className={styles.loadingSpinner}></span>}
              <span>
                {isTesting
                  ? t('settings.testing_connection', '正在测试连接...')
                  : t('settings.test_connection', '测试连接')}
              </span>
            </button>
          </div>

          {/* ProviderModelList Section */}
          <div className={styles.modelListSection}>
            <div className={styles.modelListHeader}>
              <div className={styles.modelListTitleBox}>
                <MdViewList size={20} className={styles.modelListTitleIcon} />
                <span className={styles.modelListTitle}>
                  {t('settings.model_list_count', '模型列表 ($enabled / $total)')
                    .replace('$enabled', String(activeConfig.enabledModels?.length || 0))
                    .replace('$total', String(activeConfig.models?.length || 0))}
                </span>
              </div>
              <button
                className={styles.fetchBtnLine}
                onClick={handleFetchModels}
                disabled={isFetchingModels}
              >
                {isFetchingModels ? (
                  <span className={styles.loadingSpinnerSmall}></span>
                ) : (
                  <MdSync size={16} />
                )}
                {t('settings.fetch_models', '获取模型')}
              </button>
            </div>

            {activeConfig.models && activeConfig.models.length > 0 ? (
              <div className={styles.modelsCard}>
                {(() => {
                  const sortingSet = new Set(delayedEnabledModels)
                  const enabledModels = activeConfig.models!.filter((m) => sortingSet.has(m))
                  const disabledModels = activeConfig.models!.filter((m) => !sortingSet.has(m))
                  const sortedModels = [...enabledModels, ...disabledModels]

                  const actualEnabledSet = new Set(activeConfig.enabledModels || [])

                  return sortedModels.map((mdl, idx) => {
                    const isChecked = actualEnabledSet.has(mdl)
                    const isLast = idx === sortedModels.length - 1
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
                          </span>
                        </div>
                        <Switch
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
                <MdViewList size={32} className={styles.emptyModelsIcon} />
                <span>{t('settings.no_models_hint', '暂无模型，点击右上角按钮获取')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.bottomBarArea}>
        <div className={styles.bottomBarContainer}>
          <button className={styles.saveBtn} onClick={handleSaveCurrentProviderConfig}>
            <span>{t('ai_config.save_changes_button', '保存修改')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
