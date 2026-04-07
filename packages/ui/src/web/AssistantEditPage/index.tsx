import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2, Cpu, Sparkles, Database, Thermometer, Box, Hash, MessageSquareText } from 'lucide-react';
import styles from './AssistantEditPage.module.css';

// 假设项目中已挂载此渲染器，如果在 UI 库中尚未暴露，可退化为普通渲染
import { MarkdownRenderer } from '../MarkdownRenderer';

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
  
  // 按照 B2.3 任务书新增指令字段
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
  onPickRagSpace?: () => Promise<string | null>;
}

// ─── 变量预设 ─────────────────────────────────────────────
const PROMPT_VARIABLES = [
  { label: '{{user_name}}', desc: '用户昵称' },
  { label: '{{current_date}}', desc: '当前日期' },
  { label: '{{current_time}}', desc: '当前时间' },
  { label: '{{os_info}}', desc: '系统环境' }
];

// ─── 主组件 ──────────────────────────────────────────────────

export const AssistantEditPage: React.FC<AssistantEditPageProps> = ({
  assistant,
  isLastAssistant = false,
  onSave,
  onDelete,
  onBack,
  onPickEmoji,
  onPickRagSpace,
}) => {
  const { t } = useTranslation();
  const isEditing = assistant !== null;

  // ─── 表单状态 ────────────────────
  const [name, setName] = useState(assistant?.name ?? '');
  const [emoji, setEmoji] = useState(assistant?.emoji ?? '🍵');
  const [description, setDescription] = useState(assistant?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(assistant?.welcomeMessage ?? '');
  const [ragSpaceId, setRagSpaceId] = useState(assistant?.ragSpaceId ?? '');
  
  const [contextWindow, setContextWindow] = useState(assistant?.contextWindow ?? -1);
  const [providerId, setProviderId] = useState(assistant?.providerId);
  const [modelId, setModelId] = useState(assistant?.modelId);
  
  const [compressThreshold, setCompressThreshold] = useState(assistant?.compressTokenThreshold ?? 60000);
  const [compressKeepTurns, setCompressKeepTurns] = useState(assistant?.compressKeepTurns ?? 3);

  const [temperature, setTemperature] = useState(assistant?.temperature ?? 0.7);
  const [topP, setTopP] = useState(assistant?.topP ?? 1.0);
  const [maxTokens, setMaxTokens] = useState(assistant?.maxTokens ?? 2000);

  const [saving, setSaving] = useState(false);
  const [promptMode, setPromptMode] = useState<'edit' | 'preview'>('edit');

  const isUnlimitedContext = contextWindow < 0;
  const isCompressDisabled = compressThreshold <= 0;
  const isUnlimitedMaxTokens = maxTokens <= 0;

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
        welcomeMessage: welcomeMessage.trim(),
        ragSpaceId: ragSpaceId || undefined,
        contextWindow: isUnlimitedContext ? -1 : contextWindow,
        providerId: providerId ?? undefined,
        modelId: modelId ?? undefined,
        compressTokenThreshold: isCompressDisabled ? 0 : compressThreshold,
        compressKeepTurns,
        temperature,
        topP,
        maxTokens: isUnlimitedMaxTokens ? -1 : maxTokens,
      });
    } finally {
        // Saving state managed externally if navigating away, but we clear spinner here just in case.
        setTimeout(() => setSaving(false), 800);
    }
  };

  const handlePickEmoji = async () => {
  if (onPickEmoji) {
      const picked = await onPickEmoji();
      if (picked) setEmoji(picked);
    }
  };

  const insertVariable = (variable: string) => {
  setSystemPrompt(prev => prev + variable);
  };

  const formatTokens = (tokens: number) => {
  if (tokens >= 10000) {
      const w = tokens / 10000;
      return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}${t('common.ten_thousand', '万')}`;
    }
    return String(tokens);
  };

  return (
    <div className={styles.page}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <div className={styles.appBarLeft}>
          <button className={styles.backBtn} onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <span className={styles.appBarTitle}>
            {isEditing
              ? t('assistant.edit_title', '编辑伙伴')
              : t('assistant.create_title', '创建伙伴')}
          </span>
        </div>
        {isEditing && !isLastAssistant && onDelete && (
          <div className={styles.appBarActions}>
            <button className={styles.deleteBtn} onClick={onDelete}>
              <Trash2 size={14} /> {t('common.delete', '删除')}
            </button>
          </div>
        )}
      </div>

      {/* Form Area */}
      <div className={styles.formBody}>
        <div className={styles.formContainer}>
          
          
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Sparkles size={18} className={styles.sectionIcon} />
                <span>{t('assistant.identity_card', '核心身份')}</span>
             </div>
             
             <div className={styles.avatarSection}>
                <div className={styles.avatarCircle} onClick={handlePickEmoji}>
                  {emoji}
                  <span className={styles.avatarBadge}>✦</span>
                </div>
                <span className={styles.avatarHint}>
                  {t('assistant.avatar_hint', '点击选 emoji · 长按选图片')}
                </span>
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('assistant.name_label', '伙伴名称')}</label>
                <input
                  className={styles.fieldInput}
                  placeholder={t('assistant.name_hint', '例如：知识伙伴、写作伙伴...')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('assistant.description_label', '简介')}</label>
                <input
                  className={styles.fieldInput}
                  placeholder={t('assistant.description_hint', '简短描述伙伴的用途...')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
             </div>
          </div>

          {/* Section: 行为逻辑与提示词 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Cpu size={18} className={styles.sectionIcon} />
                <span>{t('assistant.prompt_label', '系统提示词')}</span>
             </div>
             <p className={styles.fieldHint}>{t('assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}</p>
             
             <div className={styles.fieldGroup}>
                <div className={styles.promptToolbar}>
                   <div className={styles.variablePills}>
                      {PROMPT_VARIABLES.map(v => (
                         <span key={v.label} className={styles.varPill} onClick={() => insertVariable(v.label)} title={v.desc}>
                            {v.label}
                         </span>
                      ))}
                   </div>
                   <div className={styles.promptTabs}>
                      <button 
                         className={`${styles.tabBtn} ${promptMode === 'edit' ? styles.tabBtnActive : ''}`}
                         onClick={() => setPromptMode('edit')}
                      >
                         {t('common.edit_code', '编辑')}
                      </button>
                      <button 
                         className={`${styles.tabBtn} ${promptMode === 'preview' ? styles.tabBtnActive : ''}`}
                         onClick={() => setPromptMode('preview')}
                      >
                         {t('common.preview', '预览')}
                      </button>
                   </div>
                </div>

                {promptMode === 'edit' ? (
                   <textarea
                     className={`${styles.fieldTextarea} ${styles.systemPromptArea}`}
                     placeholder={t('assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}
                     value={systemPrompt}
                     onChange={(e) => setSystemPrompt(e.target.value)}
                   />
                ) : (
                   <div className={styles.fieldTextarea} style={{ minHeight: 160, overflowY: 'auto' }}>
                      {systemPrompt.trim() ? <MarkdownRenderer content={systemPrompt} /> : <span style={{color: 'var(--text-secondary)'}}>{t('assistant.no_system_prompt', '无系统设定录入...')}</span>}
                   </div>
                )}
             </div>

             <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquareText size={16}/> {t('assistant.welcome_msg', '欢迎语 (Welcome Message)')}
                </label>
                <input
                  className={styles.fieldInput}
                  placeholder={t('assistant.welcome_msg_hint', '用户开启新会话时自动发送的第一句话...')}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                />
             </div>
          </div>

          {/* Section: 外部神经连接 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Database size={18} className={styles.sectionIcon} />
                <span>{t('assistant.advanced_bindings', '外挂组件绑定')}</span>
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('assistant.bind_model_label', '绑定模型')}</label>
                {providerId && modelId ? (
                   <div className={styles.selectorCard} onClick={() => {
  /* TODO: Pop out Provider picker */}}>
                      <div className={styles.selectorIcon}><Box size={20}/></div>
                      <div className={styles.selectorContent}>
                         <div className={styles.selectorTitle}>{modelId}</div>
                         <div className={styles.selectorSubtitle}>{providerId} {t('assistant.provider_support', '提供计算服务')}</div>
                      </div>
                      <span className={styles.selectorAction} onClick={(e) => {
  e.stopPropagation(); setProviderId(undefined); setModelId(undefined);}}>
                         {t('common.unbind', '解除')}
                      </span>
                   </div>
                ) : (
                   <div className={styles.selectorCard} onClick={() => {
  /* Pick model */}}>
                      <div className={styles.selectorIcon}><Box size={20}/></div>
                      <div className={styles.selectorContent}>
                         <div className={styles.selectorTitle}>{t('assistant.use_global_model', '使用全局模型')}</div>
                         <div className={styles.selectorSubtitle}>{t('assistant.bind_model_desc', '绑定后，使用此伙伴的会话将始终使用指定模型')}</div>
                      </div>
                      <span className={styles.selectorAction}>{t('common.change', '更改')}</span>
                   </div>
                )}
             </div>

             <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('assistant.rag_knowledge', '关联知识库 (RAG Knowledge)')}</label>
                <div className={styles.selectorCard} onClick={async () => {
  if(onPickRagSpace) {


                      const space = await onPickRagSpace();
                      if(space) setRagSpaceId(space);
                   }
                }}>
                   <div className={styles.selectorIcon}><Database size={20}/></div>
                   <div className={styles.selectorContent}>
                      <div className={styles.selectorTitle}>{ragSpaceId ? `已关联空间：${ragSpaceId}` : '未关联任何知识库实体'}</div>
                      <div className={styles.selectorSubtitle}>{ragSpaceId ? '为助手注入额外的专域向量检索库资料' : '目前不附带任何额外检索设定'}</div>
                   </div>
                   <span className={styles.selectorAction}>{ragSpaceId ? '变更' : '检索'}</span>
                </div>
             </div>
          </div>

          {/* Section: 高级神经参数与压缩 */}
          <div className={styles.formSection}>
             <div className={styles.sectionHeader}>
                <Thermometer size={18} className={styles.sectionIcon} />
                <span>{t('assistant.advanced_control', '高级上下文控制 (Advanced)')}</span>
             </div>
             
             {/* Temperature */}
             <div className={styles.sliderWrapper}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>{t('settings.temperature', '创造力 / 发散度 (Temperature)')}</span>
                      <span className={styles.sliderSub}>{t('assistant.temp_desc', '降低数值更理性严谨，升高则更具发散创造力')}</span>
                   </div>
                   <span className={styles.sliderValueBox}>{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={0.0} max={2.0} step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
             </div>

             {/* Top-P */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>{t('assistant.top_p', '取样平衡限制 (Top P)')}</span>
                      <span className={styles.sliderSub}>{t('assistant.top_p_desc', '截断低概率词汇，通常不建议与 Temperature 同时进行调整')}</span>
                   </div>
                   <span className={styles.sliderValueBox}>{topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  className={styles.sliderInput}
                  min={0.1} max={1.0} step={0.05}
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                />
             </div>

             {/* Context Window */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>{t('assistant.context_window_label', '上下文轮数')}</span>
                      <span className={styles.sliderSub}>
                         {isUnlimitedContext ? t('assistant.context_unlimited_desc', '将发送所有历史消息给模型') : t('assistant.context_window_desc', '每次对话发送给模型的历史消息条数，越大记忆越多但消耗更多 Token')}
                      </span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isUnlimitedContext && <span className={styles.sliderValueBox}>{contextWindow} {t('common.turns', '轮')}</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isUnlimitedContext} onChange={(e) => setContextWindow(e.target.checked ? 10 : -1)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isUnlimitedContext && (
                   <input
                     type="range"
                     className={styles.sliderInput}
                     min={2} max={100} step={1}
                     value={contextWindow}
                     onChange={(e) => setContextWindow(Number(e.target.value))}
                   />
                )}
             </div>

             {/* Compression & Token Threshold */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>{t('assistant.compress_label', '自动压缩')}</span>
                      <span className={styles.sliderSub}>{!isCompressDisabled ? t('assistant.compress_enabled_desc', '对话超过阈值时自动将旧消息压缩为摘要') : t('assistant.compress_disabled_desc', '对话不会自动压缩，所有消息将完整保留')}</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isCompressDisabled && <span className={styles.sliderValueBox}>{formatTokens(compressThreshold)} TK</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isCompressDisabled} onChange={(e) => setCompressThreshold(e.target.checked ? 60000 : 0)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isCompressDisabled && (
                   <>
                     <input
                       type="range"
                       className={styles.sliderInput}
                       min={10000} max={1000000} step={10000}
                       value={compressThreshold}
                       onChange={(e) => setCompressThreshold(Number(e.target.value))}
                     />
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <Hash size={14} color="var(--text-secondary)"/>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)'}}>{t('assistant.compress_keep_turns_label', '保留互动轮数')}</span>
                        <input
                          type="range"
                          className={styles.sliderInput}
                          style={{ flex: 1 }}
                          min={1} max={10} step={1}
                          value={compressKeepTurns}
                          onChange={(e) => setCompressKeepTurns(Number(e.target.value))}
                        />
                        <span style={{ fontSize: 13, minWidth: 20 }}>{compressKeepTurns}</span>
                     </div>
                   </>
                )}
             </div>

             {/* Max Tokens */}
             <div className={styles.sliderWrapper} style={{ marginTop: 12 }}>
                <div className={styles.sliderHeaderLine}>
                   <div className={styles.sliderLabelWrap}>
                      <span className={styles.sliderLabel}>{t('assistant.max_tokens', '单次回复长度 (Max Tokens)')}</span>
                      <span className={styles.sliderSub}>{t('assistant.max_tokens_desc', '限制大模型所能生成的最大长度边界。')}</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     {!isUnlimitedMaxTokens && <span className={styles.sliderValueBox}>{formatTokens(maxTokens)} TK</span>}
                     <label className={styles.toggleSwitch}>
                       <input type="checkbox" checked={!isUnlimitedMaxTokens} onChange={(e) => setMaxTokens(e.target.checked ? 2000 : -1)} />
                       <span className={styles.toggleSlider}></span>
                     </label>
                   </div>
                </div>
                {!isUnlimitedMaxTokens && (
                   <input
                     type="range"
                     className={styles.sliderInput}
                     min={100} max={100000} step={100}
                     value={maxTokens}
                     onChange={(e) => setMaxTokens(Number(e.target.value))}
                   />
                )}
             </div>

          </div>

          <div className={styles.saveBtnContainer}>
             <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !name.trim()}>
                <Sparkles size={16} /> 
                {saving ? t('common.saving', '保存中...') : t('common.save', '保存')}
             </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};
