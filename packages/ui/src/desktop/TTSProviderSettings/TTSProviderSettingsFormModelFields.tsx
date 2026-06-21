import React from 'react'
import { Button } from '../Button/Button'
import styles from './TTSProviderSettings.module.css'
import type { TTSProviderSettingsViewModel } from './useTTSProviderSettings'

export function TTSProviderSettingsFormModelFields({ vm }: { vm: TTSProviderSettingsViewModel }) {
  const {
    t,
    providerType,
    currentConfig,
    updateCurrentConfig,
    comboboxRef,
    isDropdownOpen,
    setIsDropdownOpen,
    getModelOptions,
    handleSelectModel,
    handleFetchModels,
    isLoadingModels,
    onFetchModels
  } = vm

  return (
    <div className={styles.comboboxContainer} ref={comboboxRef}>
      <label className={styles.comboboxLabel}>{t('tts.settings.model_id_label', '模型 ID')}</label>
      <div className={styles.modelInputRow}>
        <div className={styles.comboboxWrapper}>
          <input
            type="text"
            placeholder={
              providerType === 'clone-tts' || providerType === 'gpt-sovits'
                ? 'default'
                : providerType === 'mimo-tts'
                  ? 'mimo-v2.5-tts'
                  : 'tts-1'
            }
            value={currentConfig.modelId}
            onChange={(e) => {
              updateCurrentConfig({ modelId: e.target.value })
              setIsDropdownOpen(true)
            }}
            onFocus={() => setIsDropdownOpen(true)}
            className={styles.comboboxInput}
          />
          <div
            className={`${styles.comboboxArrow} ${isDropdownOpen ? styles.rotated : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {isDropdownOpen && (
            <div className={styles.comboboxDropdown}>
              <ul className={styles.comboboxOptionsList}>
                {getModelOptions().map((opt) => {
                  const isSelected = opt === currentConfig.modelId
                  return (
                    <li
                      key={opt}
                      className={`${styles.comboboxOptionItem} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleSelectModel(opt)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className={styles.optionText}>{opt}</span>
                      {isSelected && (
                        <span className={styles.checkIcon}>
                          <svg
                            width="12"
                            height="9"
                            viewBox="0 0 12 9"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 4.5L4.33333 7.5L11 1.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        {onFetchModels && (
          <Button
            variant="elevated"
            onClick={handleFetchModels}
            disabled={isLoadingModels}
            className={styles.fetchModelsBtn}
          >
            {isLoadingModels
              ? t('tts.settings.fetching_models', '获取中...')
              : t('tts.settings.fetch_models', '获取')}
          </Button>
        )}
      </div>
    </div>
  )
}
