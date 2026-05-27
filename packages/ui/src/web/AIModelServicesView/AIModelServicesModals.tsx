import React from 'react'
import { createPortal } from 'react-dom'
import { MdArrowDropDown, MdClose, MdCloud } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import type { AIModelServicesViewModel } from './useAIModelServicesView'

export interface AIModelServicesModalsProps {
  vm: AIModelServicesViewModel
}

export const AIModelServicesModals: React.FC<AIModelServicesModalsProps> = ({ vm }) => {
  const {
    t,
    isAddModalOpen,
    setIsAddModalOpen,
    isTypeDropdownOpen,
    setIsTypeDropdownOpen,
    addModalData,
    setAddModalData,
    PROVIDER_TYPES,
    renderTypeIcon,
    submitAddCustomProvider,
    isTestModalOpen,
    setIsTestModalOpen,
    testModelId,
    setTestModelId,
    testModelOptions,
    isTestModelDropdownOpen,
    setIsTestModelDropdownOpen,
    confirmTestConnection
  } = vm

  return (
    <>
      {isAddModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.addModalOverlay}>
            <div className={styles.addModalContent}>
              <div className={styles.addModalHeader}>
                {t('agent.provider.add_title', '新增 AI 供应商')}
              </div>
              <div className={styles.addModalBody}>
                <div className={styles.typeFieldContainer}>
                  <span className={styles.typeLabel}>
                    {t('agent.provider.add_type_label', '供应商类型 (Client)')}
                  </span>
                  <div className={styles.customSelectOuter}>
                    <div
                      className={`${styles.customSelectValue} ${isTypeDropdownOpen ? styles.customSelectValueOpen : ''}`}
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    >
                      {renderTypeIcon(addModalData.type)}
                      <span style={{ flex: 1 }}>
                        {addModalData.type === 'openai'
                          ? t('provider.openai_spec', 'OpenAI 规范')
                          : addModalData.type.toUpperCase()}
                      </span>
                      <MdArrowDropDown
                        size={20}
                        className={`${styles.dropdownArrow} ${isTypeDropdownOpen ? styles.dropdownArrowOpen : ''}`}
                      />
                    </div>
                    {isTypeDropdownOpen && (
                      <div className={styles.customSelectMenu}>
                        {PROVIDER_TYPES.map((type) => (
                          <div
                            key={type}
                            className={styles.customSelectMenuItem}
                            onClick={() => {
                              setAddModalData({ ...addModalData, type })
                              setIsTypeDropdownOpen(false)
                            }}
                          >
                            {renderTypeIcon(type)}
                            <span>
                              {type === 'openai'
                                ? t('provider.openai_spec', 'OpenAI 规范')
                                : type.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.materialField}>
                  <span className={styles.materialLabel}>
                    {t('agent.provider.add_name_label', '供应商名称')}
                  </span>
                  <input
                    type="text"
                    className={styles.addModalInput}
                    placeholder={t('agent.provider.add_name_hint', '例如: My OpenAI Proxy')}
                    value={addModalData.name}
                    onChange={(e) => setAddModalData({ ...addModalData, name: e.target.value })}
                  />
                </div>
                <div className={styles.materialField}>
                  <span className={styles.materialLabel}>Base URL</span>
                  <input
                    type="text"
                    className={styles.addModalInput}
                    placeholder="https://api.example.com/v1"
                    value={addModalData.baseUrl}
                    onChange={(e) =>
                      setAddModalData({
                        ...addModalData,
                        baseUrl: e.target.value
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.addModalFooter}>
                <button className={styles.addModalCancel} onClick={() => setIsAddModalOpen(false)}>
                  {t('common.cancel', '取消')}
                </button>
                <button className={styles.addModalConfirm} onClick={submitAddCustomProvider}>
                  {t('agent.provider.add_button', '添加')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {isTestModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.addModalOverlay}>
            <div className={styles.addModalContent}>
              <div className={styles.addModalHeader}>
                <h3>{t('ai_config.test_connection_title', '选择测试模型')}</h3>
                <button className={styles.closeBtn} onClick={() => setIsTestModalOpen(false)}>
                  <MdClose size={20} />
                </button>
              </div>

              <div className={styles.addModalBody}>
                <p
                  style={{
                    color: 'var(--color-text-secondary)',
                    marginBottom: 15,
                    fontSize: 13,
                    userSelect: 'none'
                  }}
                >
                  {t(
                    'ai_config.test_connection_desc',
                    '请选择要用来测试连接的模型。建议使用该供应商提供的体积小、速度快的免费模型进行测试。'
                  )}
                </p>
                <div className={styles.materialField}>
                  <span className={styles.materialLabel}>
                    {t('ai_config.model_id', 'Model ID')}
                  </span>
                  <div
                    style={{ position: 'relative' }}
                    className={styles.customSelectOuter}
                    tabIndex={-1}
                    onBlur={(e) => {
                      // Check if new focus is inside the menu
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setIsTestModelDropdownOpen(false)
                      }
                    }}
                  >
                    <input
                      type="text"
                      className={styles.addModalInput}
                      placeholder={t('aiConfig.selectTestModel', '请选择测试模型')}
                      value={testModelId}
                      readOnly
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setIsTestModelDropdownOpen(true)}
                      onFocus={() => setIsTestModelDropdownOpen(true)}
                    />
                    <MdArrowDropDown
                      size={20}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        color: 'var(--color-text-secondary)',
                        pointerEvents: 'none'
                      }}
                    />
                    {isTestModelDropdownOpen && testModelOptions.length > 0 && (
                      <div
                        className={styles.customSelectMenu}
                        style={{ maxHeight: 200, overflowY: 'auto' }}
                      >
                        {testModelOptions.map((m) => (
                          <div
                            key={m}
                            className={styles.customSelectMenuItem}
                            onClick={() => {
                              setTestModelId(m)
                              setIsTestModelDropdownOpen(false)
                            }}
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.addModalFooter}>
                <button className={styles.addModalCancel} onClick={() => setIsTestModalOpen(false)}>
                  {t('common.cancel', '取消')}
                </button>
                <button className={styles.addModalConfirm} onClick={confirmTestConnection}>
                  {t('ai_config.start_test', '开始测试')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
