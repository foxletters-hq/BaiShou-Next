import { useEffect, useState, useCallback, useRef } from 'react';

export interface ToolExecution {
  name: string;
  startTime: number;
  durationMs: number;
}

export interface UseAgentStreamResult {
  text: string;
  reasoning: string;
  isStreaming: boolean;
  activeTool: { name: string; args: any } | null;
  completedTools: ToolExecution[];
  error: string | null;
  startChat: (sessionId: string, text: string, providerId?: string, modelId?: string, attachments?: any[], searchMode?: boolean) => Promise<void>;
  editChat: (sessionId: string, messageId: string, text: string, providerId?: string, modelId?: string, attachments?: any[]) => Promise<void>;
  resendChat: (sessionId: string, messageId: string, searchMode?: boolean, providerId?: string, modelId?: string) => Promise<void>;
  reset: () => void;
}

export function useAgentStream(): UseAgentStreamResult {
  const [text, setText] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<{ name: string; args: any } | null>(null);
  const [completedTools, setCompletedTools] = useState<ToolExecution[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Buffer updates to avoid too many React re-renders on fast streams
  const textRef = useRef('');
  const reasoningRef = useRef('');
  const activeToolStartRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron || !window.electron.ipcRenderer) return () => {};

    const cleanupChunk = window.electron.ipcRenderer.on('agent:stream-chunk', (_, chunk: string) => {
      textRef.current += chunk;
      setText(textRef.current);
    });

    const cleanupReasoning = window.electron.ipcRenderer.on('agent:reasoning-chunk', (_, chunk: string) => {
      reasoningRef.current += chunk;
      setReasoning(reasoningRef.current);
    });

    const cleanupToolStart = window.electron.ipcRenderer.on('agent:tool-start', (_, { name, args }) => {
      activeToolStartRef.current = Date.now();
      setActiveTool({ name, args });
    });

    const cleanupToolResult = window.electron.ipcRenderer.on('agent:tool-result', (_, { name }) => {
      const durationMs = Date.now() - activeToolStartRef.current;
      setCompletedTools(prev => [...prev, { name, startTime: activeToolStartRef.current, durationMs }]);
      setActiveTool(null);
    });

    const cleanupFinish = window.electron.ipcRenderer.on('agent:stream-finish', (_, payload) => {
      setIsStreaming(false);
      if (payload?.error) {
         setError(payload.error);
      }
      setActiveTool(null);
    });

    return () => {
      cleanupChunk();
      cleanupReasoning();
      cleanupToolStart();
      cleanupToolResult();
      cleanupFinish();
    };
  }, []);

  const startChat = useCallback(async (sessionId: string, userText: string, providerId?: string, modelId?: string, attachments?: any[], searchMode?: boolean) => {
    setIsStreaming(true);
    setError(null);
    setActiveTool(null);
    setCompletedTools([]);
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');

    await window.electron.ipcRenderer.invoke('agent:chat', { sessionId, text: userText, providerId, modelId, attachments, searchMode });
  }, []);

  const editChat = useCallback(async (sessionId: string, messageId: string, userText: string, providerId?: string, modelId?: string, attachments?: any[], searchMode?: boolean) => {
    setIsStreaming(true);
    setError(null);
    setActiveTool(null);
    setCompletedTools([]);
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');

    await window.electron.ipcRenderer.invoke('agent:edit-message', sessionId, messageId, userText, providerId, modelId, attachments, searchMode);
  }, []);

  const resendChat = useCallback(async (sessionId: string, messageId: string, searchMode?: boolean, providerId?: string, modelId?: string) => {
    setIsStreaming(true);
    setError(null);
    setActiveTool(null);
    setCompletedTools([]);
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');

    await window.electron.ipcRenderer.invoke('agent:resend', sessionId, messageId, searchMode, providerId, modelId);
  }, []);

  const reset = useCallback(() => {
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');
    setError(null);
    setIsStreaming(false);
    setActiveTool(null);
    setCompletedTools([]);
  }, []);

  return {
    text,
    reasoning,
    isStreaming,
    activeTool,
    completedTools,
    error,
    startChat,
    editChat,
    resendChat,
    reset
  };
}
