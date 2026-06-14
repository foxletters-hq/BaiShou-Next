import React from 'react'
import { History, Minimize2 } from 'lucide-react'
import { HelpTooltip } from '../HelpTooltip'
import { getDefaultCompressionSystemPrompt } from '@baishou/shared'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'

export function AssistantPickerMemoryTab({ vm }: { vm: AssistantPickerSheetViewModel }) {
  const {
    t,
    editingContextWindow,
    setEditingContextWindow,
    editingCompressEnabled,
    setEditingCompressEnabled,
    editingCompressThreshold,
    setEditingCompressThreshold,
    editingCompressKeepTurns,
    setEditingCompressKeepTurns,
    editingCompressSystemPrompt,
    setEditingCompressSystemPrompt,
    saveConfig,
    isSaving,
    i18n
  } = vm
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 8,
          gap: 8
        }}
      >
        <History size={16} color="var(--color-primary)" />
        <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          {t('agent.assistant.context_window_label', 'Context Turns')}
        </h3>
        <HelpTooltip
          content={t(
            'agent.assistant.context_window_desc',
            'How many recent conversation turns are sent to the model. One turn starts with your message and includes the assistant reply and any tool calls in that turn. More turns mean longer memory but higher token usage.'
          )}
        />
      </div>

      {/* Context Window */}
      <div className={`${styles.memoryOptionCard} ${styles.memoryOptionCardSpaced}`}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: editingContextWindow >= 0 ? 12 : 0
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            {t('agent.assistant.window_size', '窗口大小')}
          </span>
          <div style={{ flex: 1 }}></div>
          {editingContextWindow >= 0 && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: 'var(--color-primary)',
                marginRight: 4
              }}
            >
              {editingContextWindow}
            </span>
          )}
          <span
            style={{
              fontSize: 13,
              marginRight: 8,
              color: 'var(--text-primary)'
            }}
          >
            {editingContextWindow < 0
              ? t('agent.assistant.context_unlimited', '无限制')
              : t('agent.assistant.context_limited', '轮转')}
          </span>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={editingContextWindow < 0}
              onChange={(e) => {
                const newVal = e.target.checked ? -1 : 20
                setEditingContextWindow(newVal)
                saveConfig({ contextWindow: newVal })
              }}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
        {editingContextWindow >= 0 && (
          <input
            type="range"
            className={styles.sliderInput}
            min={2}
            max={100}
            step={1}
            value={editingContextWindow}
            onChange={(e) => setEditingContextWindow(Number(e.target.value))}
            onMouseUp={() => saveConfig()}
            onTouchEnd={() => saveConfig()}
          />
        )}
      </div>

      {/* Auto Compression */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 8,
          gap: 8
        }}
      >
        <Minimize2 size={16} color="var(--color-primary)" />
        <h3 className={styles.sectionTitle} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          {t('agent.assistant.compress_label', 'Auto Compress')}
        </h3>
        <HelpTooltip
          content={t(
            'agent.assistant.compress_tooltip',
            'When conversation context exceeds the set Token threshold, the system will automatically compress early conversation content, keeping recent conversation rounds.'
          )}
        />
      </div>
      <div className={styles.memoryOptionCard}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: editingCompressEnabled ? 12 : 0
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            {t('agent.assistant.status', '状态')}
          </span>
          <div style={{ flex: 1 }}></div>
          {editingCompressEnabled && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: 'var(--color-primary)',
                marginRight: 8
              }}
            >
              {editingCompressThreshold >= 10000
                ? (editingCompressThreshold / 10000).toFixed(
                    editingCompressThreshold % 10000 === 0 ? 0 : 1
                  ) + 'w'
                : editingCompressThreshold}
            </span>
          )}
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={editingCompressEnabled}
              onChange={(e) => {
                const val = e.target.checked
                setEditingCompressEnabled(val)
                if (val && editingCompressThreshold <= 0) {
                  setEditingCompressThreshold(60000)
                  saveConfig({ compressTokenThreshold: 60000 })
                } else {
                  saveConfig({
                    compressTokenThreshold: val ? editingCompressThreshold : 0
                  })
                }
              }}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
        {editingCompressEnabled && (
          <>
            <input
              type="range"
              className={styles.sliderInput}
              min={10000}
              max={1000000}
              step={10000}
              value={editingCompressThreshold}
              onChange={(e) => setEditingCompressThreshold(Number(e.target.value))}
              onMouseUp={() => saveConfig()}
              onTouchEnd={() => saveConfig()}
            />
            <div
              style={{
                width: '100%',
                height: 1,
                background: 'rgba(200,200,200,0.15)',
                margin: '16px 0'
              }}
            ></div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)'
                }}
              >
                {t('agent.assistant.compress_keep_turns_label', 'Keep Recent Turns')}
              </span>
              <div style={{ flex: 1 }}></div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: 'var(--color-primary)'
                }}
              >
                {t('agent.assistant.compress_keep_turns_unit', '$count turns').replace(
                  '$count',
                  String(editingCompressKeepTurns)
                )}
              </span>
            </div>
            <input
              type="range"
              className={styles.sliderInput}
              min={1}
              max={10}
              step={1}
              value={editingCompressKeepTurns}
              onChange={(e) => setEditingCompressKeepTurns(Number(e.target.value))}
              onMouseUp={() => saveConfig()}
              onTouchEnd={() => saveConfig()}
            />
            <div
              style={{
                width: '100%',
                height: 1,
                background: 'rgba(200,200,200,0.15)',
                margin: '16px 0'
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('agent.assistant.compress_system_prompt_label', '压缩提示词')}
              </span>
              <HelpTooltip
                content={t(
                  'agent.assistant.compress_system_prompt_desc',
                  '生成对话压缩摘要时使用的系统提示词，与摘要模板一样支持多语言。所有规则写在此提示词中；未保存自定义内容前可「恢复默认」。'
                )}
              />
              <div style={{ flex: 1 }} />
              <button
                type="button"
                style={{
                  fontSize: 12,
                  color: 'var(--color-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
                onClick={() => {
                  const def = getDefaultCompressionSystemPrompt(i18n.language)
                  setEditingCompressSystemPrompt(def)
                }}
              >
                {t('agent.assistant.compress_system_prompt_reset', '恢复默认')}
              </button>
            </div>
            <textarea
              className={styles.promptTextarea}
              rows={8}
              value={editingCompressSystemPrompt}
              onChange={(e) => setEditingCompressSystemPrompt(e.target.value)}
              spellCheck={false}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 8
              }}
            >
              <button
                type="button"
                disabled={isSaving}
                style={{
                  fontSize: 13,
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary, #fff)',
                  opacity: isSaving ? 0.6 : 1
                }}
                onClick={() => {
                  void saveConfig({
                    compressSystemPrompt: editingCompressEnabled
                      ? editingCompressSystemPrompt.trim() || null
                      : null
                  })
                }}
              >
                {t('common.save', '保存')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
