import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAgentStore } from '../agent.store';

describe('useAgentStore (Zustand IPC Flow)', () => {
  beforeEach(() => {
    // Clear Zustand store and window mocks before each test
    useAgentStore.getState().clearSession();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).window;
  });

  it('should initialize with empty messages and no loading state', () => {
    const state = useAgentStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('addMessage should append a message to the session', () => {
    const store = useAgentStore.getState();
    store.addMessage({
      id: 'test-1',
      role: 'user',
      content: 'Hello World',
      timestamp: new Date('2024-01-01T00:00:00.000Z')
    });

    const updated = useAgentStore.getState();
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].content).toBe('Hello World');
  });

  it('sendMessage in Web/RN (Fallback Mode without window.api) falls back to mocked delayed response', () => {
    const store = useAgentStore.getState();
    
    // Assure no window.api exists
    expect((globalThis as any).window).toBeUndefined();

    store.sendMessage('Test fallback');
    
    // Synchronous state check
    const pendingState = useAgentStore.getState();
    expect(pendingState.isLoading).toBe(true);
    // 1 user msg, 1 empty assistant msg
    expect(pendingState.messages).toHaveLength(2);
    expect(pendingState.messages[1].role).toBe('assistant');
    expect(pendingState.messages[1].content).toBe('');

    // Advance 1000ms dummy timeout
    vi.advanceTimersByTime(1000);

    const resolvedState = useAgentStore.getState();
    expect(resolvedState.isLoading).toBe(false);
    expect(resolvedState.messages[1].content).toBe('Mock response in Web/RN (IPC not found)');
  });

  it('sendMessage in Electron (Bridge Mode) executes agentChat IPC call via window.api', () => {
    const mockAgentChat = vi.fn();
    
    // Inject Mock Window Bridge
    (globalThis as any).window = {
      api: {
        agentChat: mockAgentChat
      }
    };

    const store = useAgentStore.getState();
    store.sendMessage('Hello Electron');

    const state = useAgentStore.getState();
    expect(state.isLoading).toBe(true);
    expect(state.messages).toHaveLength(2); // Local immediate append
    expect(mockAgentChat).toHaveBeenCalledWith('Hello Electron');
  });

  it('initIpcListeners binds stream chunks and correctly constructs text', () => {
    let internalChunkCallback: (c: string) => void = () => {};
    let internalFinishCallback: (err?: string) => void = () => {};

    // Inject Mock Window Bridge with Listener Subscriptions
    (globalThis as any).window = {
      api: {
        removeAgentListeners: vi.fn(),
        onAgentStreamChunk: vi.fn((cb) => { internalChunkCallback = cb; }),
        onAgentStreamFinish: vi.fn((cb) => { internalFinishCallback = cb; })
      }
    };

    const store = useAgentStore.getState();
    store.initIpcListeners();

    expect((globalThis as any).window.api.removeAgentListeners).toHaveBeenCalled();
    expect((globalThis as any).window.api.onAgentStreamChunk).toHaveBeenCalled();
    expect((globalThis as any).window.api.onAgentStreamFinish).toHaveBeenCalled();

    // Setup an initial blank message representing the start
    store.addMessage({ id: 'assistant-uuid', role: 'assistant', content: '', timestamp: new Date() });

    // Emulate sequential chunks arriving across IPC
    internalChunkCallback('Hi, ');
    internalChunkCallback('this is ');
    internalChunkCallback('a streaming test.');

    // Assert that the Zustand subscriber updated the content progressively
    const progressiveState = useAgentStore.getState();
    expect(progressiveState.messages[0].content).toBe('Hi, this is a streaming test.');

    // Emulate finish payload
    useAgentStore.setState({ isLoading: true });
    expect(useAgentStore.getState().isLoading).toBe(true);

    internalFinishCallback();
    expect(useAgentStore.getState().isLoading).toBe(false);
  });
});
