import React, { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import styles from './Dialog.module.css';

export interface DialogContextState {
  confirm: (message: ReactNode, title?: string) => Promise<boolean>;
  prompt: (message: ReactNode, defaultValue?: string, title?: string) => Promise<string | null>;
  alert: (message: ReactNode, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextState | null>(null);

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title?: string;
  message: ReactNode;
  defaultValue?: string;
  resolve?: (value: any) => void;
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    message: '',
  });

  const [promptValue, setPromptValue] = useState('');

  const closeDialog = useCallback((returnValue?: any) => {
    setState((prev) => {
      if (prev.resolve) prev.resolve(returnValue);
      return { ...prev, isOpen: false };
    });
  }, []);

  const alert = useCallback((message: ReactNode, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, type: 'alert', message, title, resolve });
    });
  }, []);

  const confirm = useCallback((message: ReactNode, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, type: 'confirm', message, title, resolve });
    });
  }, []);

  const prompt = useCallback((message: ReactNode, defaultValue?: string, title?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptValue(defaultValue || '');
      setState({ isOpen: true, type: 'prompt', message, title, defaultValue, resolve });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {state.isOpen && (
        <Modal isOpen={state.isOpen} onClose={() => closeDialog(state.type === 'prompt' ? null : false)} title={state.title}>
          <div className={styles.dialogContent}>
            <div className={styles.message}>{state.message}</div>
            
            {state.type === 'prompt' && (
              <Input 
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') closeDialog(promptValue);
                }}
                className={styles.promptInput}
              />
            )}
            
            <div className={styles.actions}>
              {state.type !== 'alert' && (
                <Button variant="text" onClick={() => closeDialog(state.type === 'prompt' ? null : false)}>
                  取消
                </Button>
              )}
              <Button variant="elevated" onClick={() => closeDialog(state.type === 'prompt' ? promptValue : true)}>
                确定
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextState => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
