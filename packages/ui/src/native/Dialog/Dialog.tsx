import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';
import { View, Text, TextInput } from 'react-native';
import { useNativeTheme } from '../theme';

export interface DialogContextState {
  confirm: (message: ReactNode, title?: string) => Promise<boolean>;
  prompt: (message: ReactNode, defaultValue?: string, title?: string, isMultiline?: boolean) => Promise<string | null>;
  alert: (message: ReactNode, title?: string) => Promise<void>;
  closeAll: () => void;
}

const DialogContext = createContext<DialogContextState | null>(null);

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title?: string;
  message: ReactNode;
  defaultValue?: string;
  isMultiline?: boolean;
  resolve?: (value: any) => void;
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { colors, tokens } = useNativeTheme();
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

  const closeAll = useCallback(() => {
    setState((prev) => {
      if (prev.resolve) prev.resolve(prev.type === 'prompt' ? null : false);
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

  const prompt = useCallback((message: ReactNode, defaultValue?: string, title?: string, isMultiline?: boolean): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptValue(defaultValue || '');
      setState({ isOpen: true, type: 'prompt', message, title, defaultValue, isMultiline, resolve });
    });
  }, []);

  const renderMessage = () => {
    if (typeof state.message === 'string') {
      return (
        <Text style={{ 
          fontSize: 16, 
          color: colors.textPrimary, 
          marginBottom: tokens.spacing.md,
          lineHeight: 24,
        }}>
          {state.message}
        </Text>
      );
    }
    return state.message;
  };

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, closeAll }}>
      {children}
      {state.isOpen && (
        <Modal 
          visible={state.isOpen} 
          onClose={() => closeDialog(state.type === 'prompt' ? null : false)} 
          title={state.title}
        >
          <View style={{ padding: tokens.spacing.md }}>
            {renderMessage()}
            
            {state.type === 'prompt' && (
              <TextInput
                autoFocus
                value={promptValue}
                onChangeText={setPromptValue}
                multiline={state.isMultiline}
                numberOfLines={state.isMultiline ? 6 : 1}
                style={{
                  borderWidth: 1,
                  borderColor: colors.outlineVariant,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.md,
                  backgroundColor: colors.bgSurface,
                  color: colors.textPrimary,
                  fontSize: 16,
                  marginTop: tokens.spacing.md,
                  minHeight: state.isMultiline ? 120 : 48,
                  textAlignVertical: state.isMultiline ? 'top' : 'center',
                }}
                placeholderTextColor={colors.textTertiary}
              />
            )}
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'flex-end', 
              gap: tokens.spacing.sm,
              marginTop: tokens.spacing.lg,
            }}>
              {state.type !== 'alert' && (
                <Button variant="text" onPress={() => closeDialog(state.type === 'prompt' ? null : false)}>
                  {t('common.cancel', '取消')}
                </Button>
              )}
              <Button variant="elevated" onPress={() => closeDialog(state.type === 'prompt' ? promptValue : true)}>
                {t('common.confirm', '确定')}
              </Button>
            </View>
          </View>
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
