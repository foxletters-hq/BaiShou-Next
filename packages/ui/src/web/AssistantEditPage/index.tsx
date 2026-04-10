import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2, Smile, Plus, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { AvatarEditor } from '../AvatarEditor';
import { ModelSwitcherPopup } from '../ModelSwitcherPopup';
import { Switch } from '../Switch/Switch';
import styles from './AssistantEditPage.module.css';

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
  avatarPath?: string;
  welcomeMessage?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  ragSpaceId?: string;
}

export interface AssistantEditPageProps {
  assistant: AssistantFormData | null;
  isLastAssistant?: boolean;
  onSave: (data: AssistantFormData) => void;
  onDelete?: () => void;
  onBack: () => void;
  onPickEmoji?: () => Promise<string | null>;
  providers?: any[]; // Simplified for providers list
}

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onDelete,
  onBack,
  onPickEmoji,
  providers = [],
}) => {
  const { t } = useTranslation();
  const isEditing = assistant !== null;

  const [name, setName] = useState(assistant?.name ?? '');
  const [emoji, setEmoji] = useState(assistant?.emoji ?? '🍵');
  const [description, setDescription] = useState(assistant?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '');
  const [contextWindow, setContextWindow] = useState(assistant?.contextWindow ?? -1);
  const [providerId, setProviderId] = useState(assistant?.providerId);
  const [modelId, setModelId] = useState(assistant?.modelId);
  const [compressThreshold, setCompressThreshold] = useState(assistant?.compressTokenThreshold ?? 60000);
  const [compressKeepTurns, setCompressKeepTurns] = useState(assistant?.compressKeepTurns ?? 3);
  const [avatarPath, setAvatarPath] = useState(assistant?.avatarPath ?? '');
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  const isUnlimitedContext = contextWindow < 0;
  const isCompressDisabled = compressThreshold <= 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customPromptInputRef = useRef<HTMLInputElement>(null);

  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [pickerProviders, setPickerProviders] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      (window as any).electron.ipcRenderer.invoke('agent:get-providers').then((list: any) => {
         setPickerProviders((list || []).filter((p: any) => p.isEnabled));
      }).catch(console.error);
    }
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    onSave({
      id: assistant?.id,
      name: name.trim(),
      emoji,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      contextWindow: isUnlimitedContext ? -1 : Math.round(contextWindow),
      providerId: providerId ?? undefined,
      modelId: modelId ?? undefined,
      compressTokenThreshold: isCompressDisabled ? 0 : Math.round(compressThreshold),
      compressKeepTurns: Math.round(compressKeepTurns),
      avatarPath: avatarRemoved ? '' : avatarPath,
    });
    setTimeout(() => setSaving(false), 500); 
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 10000) {
      const w = tokens / 10000;
      return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`;
    }
    return String(tokens);
  };

  const currentAvatarImagePath = (!avatarRemoved && avatarPath) ? avatarPath : null;

  return (
    <div className={styles.scaffold}>
      {/* AppBar */}
      <div className={styles.appBar}>
        <div className={styles.appBarLeft}>
          <button className={styles.iconBtn} onClick={onBack}>
            <ChevronLeft size={24} />
          </button>
          <span className={styles.appBarTitle}>
            {isEditing ? t('agent.assistant.edit_title', '编辑伙伴') : t('agent.assistant.create_title', '创建伙伴')}
          </span>
        </div>
        {isEditing && !isLastAssistant && onDelete && (
          <button className={styles.iconBtn} onClick={() => setShowDeleteConfirm(true)} title={t('common.delete', '删除')}>
            <Trash2 size={24} />
          </button>
        )}
      </div>

      {/* Body: SingleChildScrollView */}
      <div className={styles.scrollArea}>
        <div className={styles.formContainer}>
          
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <AvatarEditor 
               emoji={emoji} 
               avatarPath={currentAvatarImagePath || undefined}
               onChange={(type, value) => {
                 if (type === 'emoji') {
                    setEmoji(value);
                    setAvatarPath('');
                    setAvatarRemoved(true);
                 } else {
                    setAvatarPath(value);
                    setAvatarRemoved(false);
                    setEmoji('');
                 }
               }}
            >
              <div className={styles.avatarStack}>
                <div className={styles.avatarCircle} style={{ backgroundImage: currentAvatarImagePath ? `url(${currentAvatarImagePath})` : 'none' }}>
                  {!currentAvatarImagePath && <span className={styles.emojiText}>{emoji}</span>}
                </div>
                <div className={styles.avatarBadge}>
                  <Smile size={16} />
                </div>
              </div>
            </AvatarEditor>
            <div className={styles.avatarHint}>
              {t('agent.assistant.avatar_hint', '点击更换伙伴的图标或头像')}
            </div>
            {currentAvatarImagePath && (
              <button className={styles.textBtn} onClick={() => setAvatarRemoved(true)}>
                {t('agent.assistant.remove_avatar', '移除图片')}
              </button>
            )}
          </div>

          <div className={styles.spacer24} />

          {/* Name */}
          <label className={styles.fieldLabel}>{t('agent.assistant.name_label', '名称')}</label>
          <input 
            className={styles.inputField} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder={t('agent.assistant.name_hint', '请输入伙伴名称')} 
          />

          <div className={styles.spacer16} />

          {/* Description */}
          <label className={styles.fieldLabel}>{t('agent.assistant.description_label', '简介')}</label>
          <textarea 
            className={styles.inputField} 
            rows={2} 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder={t('agent.assistant.description_hint', '简短描述你的伙伴')} 
          />

          <div className={styles.spacer24} />

          {/* Prompt */}
          <label className={styles.fieldLabel}>{t('agent.assistant.prompt_label', '提示词')}</label>
          <textarea 
            className={`${styles.inputField} ${styles.inputFieldMulti}`} 
            rows={8} 
            value={systemPrompt} 
            onChange={(e) => setSystemPrompt(e.target.value)} 
            placeholder={t('agent.assistant.prompt_hint', '你是一个AI助手...')} 
          />

          <div className={styles.spacer24} />

          {/* Model Binding */}
          <div className={styles.row}>
            <label className={styles.fieldLabel} style={{marginBottom: 0}}>{t('agent.assistant.bind_model_label', '绑定模型')}</label>
            <div style={{flex: 1}} />
            {providerId && (
              <button className={styles.textBtn} onClick={() => { setProviderId(undefined); setModelId(undefined); }}>
                {t('agent.assistant.use_global_model', '使用全局模型')}
              </button>
            )}
          </div>
          <div className={styles.spacer8} />
          {!providerId ? (
            <button className={styles.outlinedBtn} onClick={() => setProviderPickerOpen(true)}>
              <Plus size={18} style={{marginRight: 8}} />
              {t('agent.assistant.select_model_label', '选择模型')}
            </button>
          ) : (
            <div className={styles.modelCard} onClick={() => setProviderPickerOpen(true)}>
              <div className={styles.modelIcon}>✨</div>
              <div className={styles.modelInfo}>
                <span className={styles.modelSup}>{providerId}</span>
                <span className={styles.modelSub}>{modelId}</span>
              </div>
              <ChevronRight size={20} color="var(--text-secondary, #64748B)" />
            </div>
          )}
          <div className={styles.descText} style={{marginTop: 4}}>
            {t('agent.assistant.bind_model_desc', '如果不绑定，则使用全局默认模型')}
          </div>

          <div className={styles.spacer24} />

          {/* Context Section */}
          <div className={styles.row}>
            <label className={styles.fieldLabel} style={{marginBottom: 0}}>{t('agent.assistant.context_window_label', '上下文轮数')}</label>
            <div style={{flex: 1}} />
            {!isUnlimitedContext && <span className={styles.valueText}>{Math.round(contextWindow)}</span>}
            <span className={styles.descText} style={{marginLeft: 4, marginRight: 8}}>
              {isUnlimitedContext ? t('agent.assistant.context_unlimited', '无限') : t('agent.assistant.context_limited', '有限')}
            </span>
            <Switch 
              checked={isUnlimitedContext} 
              onChange={(e) => setContextWindow(e.target.checked ? -1 : 20)} 
            />
          </div>
          {!isUnlimitedContext && (
            <input 
              type="range" 
              className={styles.rangeInput} 
              min={2} max={100} step={1} 
              value={contextWindow} 
              onChange={(e) => setContextWindow(Number(e.target.value))} 
            />
          )}
          <div className={styles.descText}>
            {isUnlimitedContext 
              ? t('agent.assistant.context_unlimited_desc', '发送所有历史消息（可能消耗大量 Token）') 
              : t('agent.assistant.context_window_desc', '每次对话携带的历史消息上下文轮数')}
          </div>

          <div className={styles.spacer24} />

          {/* Compression Section */}
          <div className={styles.row}>
            <label className={styles.fieldLabel} style={{marginBottom: 0}}>{t('agent.assistant.compress_label', '自动压缩')}</label>
            <div style={{flex: 1}} />
            {!isCompressDisabled && <span className={styles.valueText}>{formatTokens(Math.round(compressThreshold))}</span>}
            <div style={{width: 8}} />
            <Switch 
              checked={!isCompressDisabled} 
              onChange={(e) => setCompressThreshold(e.target.checked ? 60000 : 0)} 
            />
          </div>
          <div className={styles.descText}>
            {isCompressDisabled 
              ? t('agent.assistant.compress_disabled_desc', '如果无限制上下文，超过模型上限会导致出错') 
              : t('agent.assistant.compress_enabled_desc', '超过预设体积将丢弃早期会话（并自动压缩）')}
          </div>

          {!isCompressDisabled && (
            <>
              <input 
                type="range" 
                className={styles.rangeInput} 
                min={10000} max={1000000} step={10000} 
                value={compressThreshold} 
                onChange={(e) => setCompressThreshold(Number(e.target.value))} 
              />
              <div className={styles.spacer16} />
              <div className={styles.row}>
                <label className={styles.fieldLabel} style={{marginBottom: 0}}>{t('agent.assistant.compress_keep_turns_label', '压缩后保留轮数')}</label>
                <div style={{flex: 1}} />
                <span className={styles.valueText}>{Math.round(compressKeepTurns)} {t('common.turns', '轮')}</span>
              </div>
              <div className={styles.descText}>
                {t('agent.assistant.compress_keep_turns_desc', '触发压缩时尾部强行保留几轮原文对话')}
              </div>
              <input 
                type="range" 
                className={styles.rangeInput} 
                min={1} max={10} step={1} 
                value={compressKeepTurns} 
                onChange={(e) => setCompressKeepTurns(Number(e.target.value))} 
              />
            </>
          )}

          <div className={styles.spacer16} />

          {/* Save Button */}
          <button className={styles.filledBtn} onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={20} className={styles.spinIcon} /> : t('common.save', '保存')}
          </button>
        </div>
      </div>

      {providerPickerOpen && (
        <ModelSwitcherPopup
          providers={pickerProviders.map(p => ({
            id: p.id,
            name: p.name || p.id,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: (p.enabledModels && p.enabledModels.length > 0) ? p.enabledModels : (p.models || [])
          }))}
          currentProviderId={providerId || ''}
          currentModelId={modelId || ''}
          onSelect={(pid, mid) => {
             setProviderId(pid);
             setModelId(mid);
             setProviderPickerOpen(false);
          }}
          onClose={() => setProviderPickerOpen(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className={styles.dialogOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeaderIcon}>
               <Trash2 size={32} color="var(--color-error, #F44336)" />
            </div>
            <div className={styles.dialogTitle}>
              {t('agent.assistant.delete_confirm_title', '确定要删除此伙伴吗？')}
            </div>
            <div className={styles.dialogText}>
              {t('agent.assistant.delete_confirm_content', '此操作将永久抹除其所有设定、记忆及对话记录，删除后无法恢复。')}
            </div>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                className={`${styles.dialogBtn} ${styles.dialogBtnDanger}`}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete();
                }}
              >
                {t('common.delete', '确认删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
