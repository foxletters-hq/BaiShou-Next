import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AssistantEditPage.module.css';

// ─── 类型定义 ──────────────────────────────────────────────

export interface AssistantFormData {
  id?: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  contextWindow: number;
  providerId?: string;
  modelId?: string;
  compressTokenThreshold: number;
  compressKeepTurns: number;
}

export interface AssistantEditPageProps {
  /** null = 创建模式，传入数据 = 编辑模式 */
  assistant: AssistantFormData | null;
  isLastAssistant?: boolean;
  onSave: (data: AssistantFormData) => void;
  onDelete?: () => void;
  onBack: () => void;
  onPickEmoji?: () => Promise<string | null>;
}

// ─── 主组件 ──────────────────────────────────────────────────

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onDelete,
  onBack,
  onPickEmoji,
}) => {
  const { t } = useTranslation();
  const isEditing = assistant !== null;

  // ─── 表单状态 ────────────────────
  const [name, setName] = useState(assistant?.name ?? '');
  const [emoji, setEmoji] = useState(assistant?.emoji ?? '🍵');
  const [description, setDescription] = useState(assistant?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '');
  const [contextWindow, setContextWindow] = useState(assistant?.contextWindow ?? -1);
  const [providerId, setProviderId] = useState(assistant?.providerId);
  const [modelId, setModelId] = useState(assistant?.modelId);
  const [compressThreshold, setCompressThreshold] = useState(
    assistant?.compressTokenThreshold ?? 60000,
  );
  const [compressKeepTurns, setCompressKeepTurns] = useState(
    assistant?.compressKeepTurns ?? 3,
  );
  const [saving, setSaving] = useState(false);

  const isUnlimitedContext = contextWindow < 0;
  const isCompressDisabled = compressThreshold <= 0;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      onSave({
        id: assistant?.id,
        name: name.trim(),
        emoji,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        contextWindow: isUnlimitedContext ? -1 : contextWindow,
        providerId: providerId ?? undefined,
        modelId: modelId ?? undefined,
        compressTokenThreshold: isCompressDisabled ? 0 : compressThreshold,
        compressKeepTurns,
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePickEmoji = async () => {
    if (onPickEmoji) {
      const picked = await onPickEmoji();
      if (picked) setEmoji(picked);
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 10000) {
      const w = tokens / 10000;
      return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}万`;
    }
    return String(tokens);
  };

  return (
    <div className={styles.page}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <div className={styles.appBarLeft}>
          <button className={styles.backBtn} onClick={onBack}>
            ←
          </button>
          <span className={styles.appBarTitle}>
            {isEditing
              ? t('agent.assistant.edit_title', '编辑伙伴')
              : t('agent.assistant.create_title', '创建伙伴')}
          </span>
        </div>
        {isEditing && !isLastAssistant && onDelete && (
          <div className={styles.appBarActions}>
            <button className={styles.deleteBtn} onClick={onDelete}>
              🗑️ {t('common.delete', '删除')}
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <div className={styles.formBody}>
        <div className={styles.formContainer}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarCircle} onClick={handlePickEmoji}>
              {emoji}
              <span className={styles.avatarBadge}>😀</span>
            </div>
            <span className={styles.avatarHint}>
              {t('agent.assistant.avatar_hint', '点击更换表情')}
            </span>
          </div>

          {/* Name */}
          <div>
            <label className={styles.fieldLabel}>
              {t('agent.assistant.name_label', '名称')}
            </label>
            <input
              className={styles.fieldInput}
              placeholder={t('agent.assistant.name_hint', '给伙伴起个名字')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className={styles.fieldLabel}>
              {t('agent.assistant.description_label', '简介')}
            </label>
            <input
              className={styles.fieldInput}
              placeholder={t(
                'agent.assistant.description_hint',
                '一句话描述伙伴的用途',
              )}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className={styles.fieldLabel}>
              {t('agent.assistant.prompt_label', '提示词')}
            </label>
            <textarea
              className={styles.fieldTextarea}
              placeholder={t(
                'agent.assistant.prompt_hint',
                '定义伙伴的行为和人格...',
              )}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* Model Binding */}
          <div>
            <div className={styles.switchRow}>
              <label className={styles.fieldLabel} style={{ margin: 0 }}>
                {t('agent.assistant.bind_model_label', '绑定模型')}
              </label>
              {providerId && (
                <button
                  className={styles.clearModelBtn}
                  onClick={() => {
                    setProviderId(undefined);
                    setModelId(undefined);
                  }}
                >
                  {t('agent.assistant.use_global_model', '使用全局模型')}
                </button>
              )}
            </div>
            {providerId && modelId ? (
              <div className={styles.modelCard}>
                <span className={styles.modelIcon}>✨</span>
                <div className={styles.modelInfo}>
                  <span className={styles.modelProvider}>{providerId}</span>
                  <span className={styles.modelName}>{modelId}</span>
                </div>
                <span className={styles.modelChevron}>›</span>
              </div>
            ) : (
              <div className={styles.modelCard}>
                <span className={styles.modelIcon}>＋</span>
                <span className={styles.modelName}>
                  {t('agent.assistant.select_model_label', '选择模型')}
                </span>
              </div>
            )}
          </div>

          {/* Context Window */}
          <div className={styles.sliderSection}>
            <div className={styles.sliderHeader}>
              <label className={styles.fieldLabel} style={{ margin: 0 }}>
                {t('agent.assistant.context_window_label', '上下文轮数')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!isUnlimitedContext && (
                  <span className={styles.sliderValue}>{contextWindow}</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {isUnlimitedContext ? '无限' : '有限'}
                </span>
                <input
                  type="checkbox"
                  checked={isUnlimitedContext}
                  onChange={(e) =>
                    setContextWindow(e.target.checked ? -1 : 20)
                  }
                />
              </div>
            </div>
            {!isUnlimitedContext && (
              <input
                type="range"
                className={styles.sliderInput}
                min={2}
                max={100}
                value={contextWindow}
                onChange={(e) => setContextWindow(Number(e.target.value))}
              />
            )}
            <span className={styles.sliderDesc}>
              {isUnlimitedContext
                ? t(
                    'agent.assistant.context_unlimited_desc',
                    '不限制上下文轮数，可能消耗更多 Token',
                  )
                : t(
                    'agent.assistant.context_window_desc',
                    '保留最近的对话轮数作为上下文',
                  )}
            </span>
          </div>

          {/* Compression */}
          <div className={styles.sliderSection}>
            <div className={styles.sliderHeader}>
              <label className={styles.fieldLabel} style={{ margin: 0 }}>
                {t('agent.assistant.compress_label', '会话压缩')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!isCompressDisabled && (
                  <span className={styles.sliderValue}>
                    {formatTokens(compressThreshold)}
                  </span>
                )}
                <input
                  type="checkbox"
                  checked={!isCompressDisabled}
                  onChange={(e) =>
                    setCompressThreshold(e.target.checked ? 60000 : 0)
                  }
                />
              </div>
            </div>
            {!isCompressDisabled && (
              <>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={10000}
                  max={1000000}
                  step={10000}
                  value={compressThreshold}
                  onChange={(e) =>
                    setCompressThreshold(Number(e.target.value))
                  }
                />
                <div
                  className={styles.sliderHeader}
                  style={{ marginTop: 16 }}
                >
                  <span className={styles.fieldLabel} style={{ margin: 0 }}>
                    {t(
                      'agent.assistant.compress_keep_turns_label',
                      '保留轮数',
                    )}
                  </span>
                  <span className={styles.sliderValue}>
                    {compressKeepTurns} 轮
                  </span>
                </div>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={1}
                  max={10}
                  value={compressKeepTurns}
                  onChange={(e) =>
                    setCompressKeepTurns(Number(e.target.value))
                  }
                />
              </>
            )}
            <span className={styles.sliderDesc}>
              {isCompressDisabled
                ? t(
                    'agent.assistant.compress_disabled_desc',
                    '关闭自动压缩，上下文可能无限增长',
                  )
                : t(
                    'agent.assistant.compress_enabled_desc',
                    '当 Token 数超过阈值时自动压缩旧对话',
                  )}
            </span>
          </div>

          {/* Save Button */}
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving
              ? '保存中...'
              : t('common.save', '保存')}
          </button>
        </div>
      </div>
    </div>
  );
};
