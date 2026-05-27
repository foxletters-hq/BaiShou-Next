import React from 'react'
import { History, Minimize2 } from 'lucide-react'
import { HelpTooltip } from '../HelpTooltip'
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
    saveConfig
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
      <div
        style={{
          padding: 14,
          border: '1px solid rgba(var(--color-outline-variant-rgb, 200,200,200), 0.2)',
          borderRadius: 12,
          marginBottom: 20,
          background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))'
        }}
      >
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
      <div
        style={{
          padding: 14,
          border: '1px solid rgba(var(--color-outline-variant-rgb, 200,200,200), 0.2)',
          borderRadius: 12,
          background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))'
        }}
      >
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
          </>
        )}
      </div>
    </>
  )
}
