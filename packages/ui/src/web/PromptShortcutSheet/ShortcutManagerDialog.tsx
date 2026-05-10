import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import { Terminal, Zap, Edit2, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PromptShortcut } from './index';

// We reuse some styles from others or use inline
export interface ShortcutManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: PromptShortcut[];
  onAdd: (shortcut: PromptShortcut) => Promise<void>;
  onUpdate: (shortcut: PromptShortcut) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelect?: (shortcut: PromptShortcut) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30];

export const ShortcutManagerDialog: React.FC<ShortcutManagerDialogProps> = ({
  isOpen,
  onClose,
  shortcuts,
  onAdd,
  onUpdate,
  onDelete,
  onSelect
}) => {
  const { t } = useTranslation();
  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null);
  
  const [draftId, setDraftId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftCommand, setDraftCommand] = useState('');
  const [draftContent, setDraftContent] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Calculate pagination
  const totalPages = Math.ceil(shortcuts.length / pageSize);
  const paginatedShortcuts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return shortcuts.slice(startIndex, startIndex + pageSize);
  }, [shortcuts, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleEdit = (item: PromptShortcut) => {
    setEditingItem(item);
    setDraftId(item.id);
    setDraftName(item.name || item.tag || '');
    setDraftCommand(item.command || '');
    setDraftContent(item.content || '');
  };

  const handleCreateNew = () => {
    setEditingItem({ id: 'new', content: '' });
    setDraftId(`custom-${Date.now()}`);
    setDraftName('');
    setDraftCommand('');
    setDraftContent('');
  };

  const handleSave = async () => {
    if (!draftContent.trim()) return;
    
    // Command is usually derived from ID or explicitly set.
    // For custom ones we use the command field if provided, otherwise use name
    const newItem: PromptShortcut = {
      ...editingItem,
      id: draftId,
      name: draftName,
      tag: draftName,
      content: draftContent,
      command: draftCommand || draftName || draftContent.trim().substring(0, 20).replace(/\n/g, '') || 'shortcut'
    };

    if (editingItem?.id === 'new') {
      await onAdd(newItem);
    } else {
      await onUpdate(newItem);
    }
    setEditingItem(null);
  };

  const isDefault = (id: string) => id.startsWith('default-');

  return (
    <Modal isOpen={isOpen} onClose={() => { setEditingItem(null); onClose(); }}>
      <div style={{ width: '600px', backgroundColor: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
             <Zap size={18} color="var(--color-primary)" />
             {t('shortcut.manager_title', '快捷指令组合面板')}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {!editingItem && (
              <button 
                onClick={handleCreateNew}
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
              >
                <Plus size={14} /> {t('shortcut.addCustomCommand', '新增自定义指令')}
              </button>
            )}
            <button
               onClick={() => { setEditingItem(null); onClose(); }}
               style={{ background: 'var(--bg-surface-high)', color: 'var(--text-primary)', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
               {t('common.back', '返回')}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: 'var(--bg-surface-lowest)' }}>
           {editingItem ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>{t('shortcut.label_name', '指令标识名 (展示标签)')}</label>
                  <input 
                    value={draftName} 
                    onChange={e => setDraftName(e.target.value)} 
                    placeholder={t('shortcut.label_hint', '例如: Code Review')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', outline: 'none', fontSize: 14 }}
                  />
               </div>
               <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>{t('shortcut.command_label', '指令命令 (用于触发)')}</label>
                  <input 
                    value={draftCommand} 
                    onChange={e => setDraftCommand(e.target.value)} 
                    placeholder={t('shortcut.command_hint', '例如: review, translate')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', outline: 'none', fontSize: 14 }}
                  />
               </div>
               <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>{t('shortcut.content_prompt', '实际注入内容 (Prompt)')}</label>
                  <textarea 
                    value={draftContent} 
                    onChange={e => setDraftContent(e.target.value)} 
                    placeholder={t('shortcut.content_hint', '在此输入将会插入到对话框的长文本预设指令...')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', outline: 'none', fontSize: 14, minHeight: '120px', resize: 'vertical' }}
                  />
               </div>

               <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
                 <button onClick={() => setEditingItem(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('common.cancel', '取消')}</button>
                 <button onClick={handleSave} disabled={!draftContent.trim()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: !draftContent.trim() ? 0.5 : 1 }}>{t('common.save', '保存')}</button>
               </div>
             </div>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {paginatedShortcuts.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', gap: 12 }}>
                     <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(var(--color-primary-rgb, 91, 168, 245), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-primary)' }}>
                        {s.icon ? <span style={{ fontSize: 16 }}>{s.icon}</span> : <Terminal size={16} />}
                     </div>
                     <div style={{ flex: 1, overflow: 'hidden' }} onClick={() => onSelect && onSelect(s)}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                           <span style={{ fontSize: 14, fontWeight: 800 }}>/{s.command || s.name || s.tag || 'unnamed'}</span>
                           <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-surface-high)', padding: '2px 6px', borderRadius: 4 }}>{s.name || s.tag || t('shortcut.default_tag', '指令')}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {s.description || s.content}
                        </div>
                     </div>
                     
                     <div style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'center' }}>
                        <button 
                           onClick={() => onSelect && onSelect(s)}
                           style={{ padding: '6px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >{t('common.use', '使用')}</button>
                        {!isDefault(s.id) && (
                          <>
                            <button onClick={() => handleEdit(s)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }} title={t('common.edit', '编辑')}><Edit2 size={16} /></button>
                            <button onClick={() => onDelete(s.id)} style={{ background: 'transparent', border: 'none', color: '#f44336', cursor: 'pointer', padding: 4 }} title={t('common.delete', '删除')}><Trash2 size={16} /></button>
                          </>
                        )}
                     </div>
                  </div>
                ))}
                {shortcuts.length === 0 && (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {t('shortcut.no_shortcuts_hint', '暂无任何快捷指令，立即创建一个吧。')}
                  </div>
                )}
                
                {/* Pagination Controls */}
                {shortcuts.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.page_size', '每页显示')}:</span>
                      <select 
                        value={pageSize} 
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', fontSize: 12, cursor: 'pointer' }}
                      >
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {t('common.page_info', '{{current}} / {{total}}', { current: currentPage, total: totalPages })}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={() => handlePageChange(currentPage - 1)} 
                          disabled={currentPage === 1}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: currentPage === 1 ? 'var(--bg-surface-high)' : 'var(--bg-surface)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button 
                          onClick={() => handlePageChange(currentPage + 1)} 
                          disabled={currentPage === totalPages}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: currentPage === totalPages ? 'var(--bg-surface-high)' : 'var(--bg-surface)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
             </div>
           )}
        </div>
      </div>
    </Modal>
  );
};
