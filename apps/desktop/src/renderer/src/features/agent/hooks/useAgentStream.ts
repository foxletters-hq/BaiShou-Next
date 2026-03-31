import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseAgentStreamResult {
  text: string;
  reasoning: string;
  isStreaming: boolean;
  activeTool: { name: string; args: any } | null;
  error: string | null;
  startChat: (sessionId: string, text: string) => Promise<void>;
  reset: () => void;
}

export function useAgentStream(): UseAgentStreamResult {
  const [text, setText] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<{ name: string; args: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Buffer updates to avoid too many React re-renders on fast streams
  const textRef = useRef('');
  const reasoningRef = useRef('');

  useEffect(() => {
    // 注册所有来自下行大引擎的脉冲侦听器
    const cleanupChunk = window.electron.ipcRenderer.on('agent:stream-chunk', (_, chunk: string) => {
      textRef.current += chunk;
      setText(textRef.current);
    });

    const cleanupReasoning = window.electron.ipcRenderer.on('agent:reasoning-chunk', (_, chunk: string) => {
      reasoningRef.current += chunk;
      setReasoning(reasoningRef.current);
    });

    const cleanupToolStart = window.electron.ipcRenderer.on('agent:tool-start', (_, { name, args }) => {
      setActiveTool({ name, args });
    });

    const cleanupToolResult = window.electron.ipcRenderer.on('agent:tool-result', () => {
      // 工具完成一次执行可做日志流，但这里最简单的实现就是闪烁或取消状态
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

  const startChat = useCallback(async (sessionId: string, userText: string) => {
    setIsStreaming(true);
    setError(null);
    setActiveTool(null);
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');

    await window.electron.ipcRenderer.invoke('agent:chat', { sessionId, text: userText });
  }, []);

  const reset = useCallback(() => {
    textRef.current = '';
    reasoningRef.current = '';
    setText('');
    setReasoning('');
    setError(null);
    setIsStreaming(false);
    setActiveTool(null);
  }, []);

  return {
    text,
    reasoning,
    isStreaming,
    activeTool,
    error,
    startChat,
    reset
  };
}
