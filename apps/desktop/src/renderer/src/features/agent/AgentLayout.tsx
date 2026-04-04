import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { AgentSidebar } from './components/AgentSidebar';
import type { AgentAssistant } from './components/AgentSidebar';
import { useAssistantStore } from '@baishou/store';
import { type SessionData, useToast } from '@baishou/ui';
import { MdAutoAwesome } from 'react-icons/md';
import styles from './AgentLayout.module.css';

export const AgentLayout: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  
  const { assistants, fetchAssistants } = useAssistantStore();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pinnedAssistants, setPinnedAssistants] = useState<AgentAssistant[]>([]);
  // 重命名 inline modal 状态
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const loadSessions = async () => {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const data = await window.electron.ipcRenderer.invoke('agent:get-sessions');
        setSessions(data || []);
      }
    } catch (e) {
      console.error('[AgentLayout] Failed to load sessions:', e);
    }
  };

  useEffect(() => {
    fetchAssistants();
    loadSessions();
  }, [fetchAssistants]);

  useEffect(() => {
    // Populate fake pinned assistants if assistants load
    if (assistants.length > 0 && pinnedAssistants.length === 0) {
      // Just pin the first 3 for UI testing
      setPinnedAssistants(assistants.slice(0, 3).map(a => ({
        id: String(a.id),
        name: a.name,
        emoji: a.emoji,
        avatarPath: (a as any).avatarPath
      })));
    }
  }, [assistants, pinnedAssistants.length]);

  const currentAssistant = assistants.find(a => String(a.id) === sessionId) || 
                           assistants.find(a => a.isDefault) || 
                           (assistants.length > 0 ? assistants[0] : undefined);

  // 始终有一个 mappedAssistant — 如果还在加载就显示 fallback placeholder
  const mappedAssistant = currentAssistant ? {
    id: String(currentAssistant.id),
    name: currentAssistant.name,
    description: currentAssistant.description || '通用 AI 伙伴',
    emoji: currentAssistant.emoji,
    avatarPath: (currentAssistant as any).avatarPath
  } : undefined; // undefined 触发骨架态

  const handleNewChat = async () => {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const newId = await window.electron.ipcRenderer.invoke('agent:create-session', {
           assistantId: currentAssistant?.id
        });
        if (newId) {
          navigate(`/c/${newId}`);
          loadSessions();
          return;
        }
      }
    } catch (e) {}
    navigate(`/c/new-${Date.now()}`);
  };

  const handleSelect = (id: string) => {
    navigate(`/c/${id}`);
  };

  const handlePin = async (id: string) => {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const s = sessions.find(s => s.id === id);
        if (s) {
          await window.electron.ipcRenderer.invoke('agent:pin-session', id, !s.isPinned);
          loadSessions();
        }
      }
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        await window.electron.ipcRenderer.invoke('agent:delete-sessions', [id]);
        loadSessions();
        if (sessionId === id) navigate('/agent');
      }
    } catch (e) {}
  };

  const handleBatchDelete = async (ids: string[]) => {
    try {
      if (typeof window !== 'undefined' && window.electron) {
        await window.electron.ipcRenderer.invoke('agent:delete-sessions', ids);
        loadSessions();
        if (sessionId && ids.includes(sessionId)) navigate('/agent');
      }
    } catch (e) {}
  };

  const handleRename = (id: string) => {
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    // 弹出内联重命名框
    setRenameTarget({ id, title: s.title || '' });
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const commitRename = async () => {
    if (!renameTarget) return;
    const newTitle = renameTarget.title.trim();
    if (newTitle && window.electron) {
      await window.electron.ipcRenderer.invoke('agent:update-session-title', renameTarget.id, newTitle);
      loadSessions();
      toast.showSuccess('已重命名为「' + newTitle + '」');
    }
    setRenameTarget(null);
  };

  const handleAssistantSwitched = (_assistant: AgentAssistant) => {
     // 切换伙伴时：开启新对话
     handleNewChat();
  };

  return (
    <div className={styles.layoutContainer}>
      {!isSidebarCollapsed ? (
        <AgentSidebar
          currentAssistant={mappedAssistant}
          sessions={sessions}
          selectedSessionId={sessionId}
          searchQuery={searchQuery}
          pinnedAssistants={pinnedAssistants}
          onSearchQueryChanged={setSearchQuery}
          onSessionSelected={handleSelect}
          onNewSession={handleNewChat}
          onAssistantSwitched={handleAssistantSwitched}
          onPinSession={handlePin}
          onDeleteSession={handleDelete}
          onRenameSession={handleRename}
          onBatchDelete={handleBatchDelete}
          onCollapse={() => setIsSidebarCollapsed(true)}
        />
      ) : (
        /* 折叠态：显示一个紧凑的图标栏，点击展开 */
        <div className={styles.collapsedRail} onClick={() => setIsSidebarCollapsed(false)} title="展开侧边栏">
          <div className={styles.collapsedIcon}>
            <MdAutoAwesome size={22} color="#fff" />
          </div>
        </div>
      )}
      
      <div className={styles.chatArea}>
        <Outlet />
      </div>

      {/* ─── 内联重命名 Toast Modal ─── */}
      {renameTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
        }} onClick={() => setRenameTarget(null)}>
          <div style={{
            background: 'var(--bg-surface, #fff)',
            borderRadius: 16,
            padding: '24px 24px 16px',
            width: 320,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text-primary, #1e293b)' }}>
              重命名对话
            </div>
            <input
              ref={renameInputRef}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.4)',
                fontSize: 14,
                outline: 'none',
                background: 'var(--bg-surface-highlight, #f8fafc)',
                color: 'var(--text-primary, #1e293b)',
                boxSizing: 'border-box',
              }}
              value={renameTarget.title}
              onChange={e => setRenameTarget({ ...renameTarget, title: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenameTarget(null);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}
                onClick={() => setRenameTarget(null)}
              >
                取消
              </button>
              <button
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary, #5BA8F5)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                onClick={commitRename}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
