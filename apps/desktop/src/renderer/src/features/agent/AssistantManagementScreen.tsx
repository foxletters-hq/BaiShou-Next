import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantManagementPage, AssistantEditPage } from '@baishou/ui';
import { motion, AnimatePresence } from 'framer-motion';

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: 'easeOut' }
};

export const AssistantManagementScreen: React.FC = () => {
  const [assistants, setAssistants] = useState<any[]>([]);
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const navigate = useNavigate();
  
  const loadAssistants = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const data = await window.electron.ipcRenderer.invoke('agent:get-assistants');
      setAssistants(data || []);
    }
  };
  
  useEffect(() => { loadAssistants(); }, []);

  // Determine current view key for AnimatePresence
  const viewKey = isCreatingNew ? 'create' : editingAssistantId ? `edit-${editingAssistantId}` : 'list';

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {isCreatingNew ? (
          <motion.div
            key="create"
            style={{ height: '100%' }}
            {...pageTransition}
          >
            <AssistantEditPage
              assistant={null}
              onSave={async (data) => {
                if (typeof window !== 'undefined' && window.electron) {
                  const newId = `ast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                  await window.electron.ipcRenderer.invoke('agent:create-assistant', { ...data, id: newId });
                  await loadAssistants();
                }
                setIsCreatingNew(false);
              }}
              onBack={() => setIsCreatingNew(false)}
            />
          </motion.div>
        ) : editingAssistantId ? (
          <motion.div
            key={`edit-${editingAssistantId}`}
            style={{ height: '100%' }}
            {...pageTransition}
          >
            {(() => {
              const target = assistants.find(a => a.id === editingAssistantId);
              if (target) {
                return (
                  <AssistantEditPage
                    assistant={target}
                    onSave={async (data) => {
                      if (typeof window !== 'undefined' && window.electron) {
                        await window.electron.ipcRenderer.invoke('agent:update-assistant', target.id, data);
                        await loadAssistants();
                      }
                      setEditingAssistantId(null);
                    }}
                    onBack={() => setEditingAssistantId(null)}
                    onDelete={async () => {
                      if (typeof window !== 'undefined' && window.electron) {
                        await window.electron.ipcRenderer.invoke('agent:delete-assistant', target.id);
                        await loadAssistants();
                      }
                      setEditingAssistantId(null);
                    }}
                  />
                );
              }
              return null;
            })()}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            style={{ height: '100%' }}
            {...pageTransition}
          >
            <AssistantManagementPage
              assistants={assistants}
              onCreate={() => setIsCreatingNew(true)}
              onEdit={(assistant) => setEditingAssistantId(assistant.id)}
              onDelete={async (id) => {
                if (typeof window !== 'undefined' && window.electron) {
                   await window.electron.ipcRenderer.invoke('agent:delete-assistant', id);
                   loadAssistants();
                }
              }}
              pinnedIds={new Set()}
              onTogglePin={async (id) => {
                if (typeof window !== 'undefined' && window.electron) {
                   await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, true);
                   loadAssistants();
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

