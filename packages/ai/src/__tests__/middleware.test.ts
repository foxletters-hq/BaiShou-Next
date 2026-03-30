import { describe, it, expect } from 'vitest';
import { MiddlewareChain } from '../middleware/message-middleware';
import type { MessageMiddleware } from '../middleware/message-middleware';
import { GeminiThoughtSignatureMiddleware } from '../middleware/gemini-thought-signature';
import { buildMiddlewareChain } from '../middleware/middleware-factory';
import type { CoreMessage } from 'ai';

describe('Middleware Pipeline', () => {
  describe('MiddlewareChain', () => {
    it('should apply middlewares in order', () => {
      // 使用简化的中间件来测试链式调用顺序
      const appendA: MessageMiddleware = {
        name: 'test-a',
        process: (msgs) =>
          msgs.map((m) => ({ ...m, content: `${String(m.content)}-a` }) as CoreMessage),
      };

      const appendB: MessageMiddleware = {
        name: 'test-b',
        process: (msgs) =>
          msgs.map((m) => ({ ...m, content: `${String(m.content)}-b` }) as CoreMessage),
      };

      const chain = new MiddlewareChain([appendA, appendB]);

      const input: CoreMessage[] = [
        { role: 'user', content: 'hello' },
      ];
      const result = chain.apply(input);

      expect(String(result[0]!.content)).toBe('hello-a-b');
    });

    it('should report isEmpty correctly', () => {
      expect(new MiddlewareChain([]).isEmpty).toBe(true);
      expect(
        new MiddlewareChain([
          { name: 'test', process: (m) => m },
        ]).isEmpty,
      ).toBe(false);
    });
  });

  describe('GeminiThoughtSignatureMiddleware', () => {
    it('should have correct name', () => {
      const mw = new GeminiThoughtSignatureMiddleware();
      expect(mw.name).toBe('gemini-thought-signature-skip');
    });

    it('should not modify user messages', () => {
      const mw = new GeminiThoughtSignatureMiddleware();
      const messages: CoreMessage[] = [
        { role: 'user', content: 'hello' },
      ];

      const result = mw.process(messages);
      expect(result).toEqual(messages);
    });
  });

  describe('buildMiddlewareChain', () => {
    it('should return non-empty chain for gemini', () => {
      const chain = buildMiddlewareChain('gemini');
      expect(chain.isEmpty).toBe(false);
    });

    it('should return empty chain for openai', () => {
      const chain = buildMiddlewareChain('openai');
      expect(chain.isEmpty).toBe(true);
    });

    it('should return empty chain for anthropic', () => {
      const chain = buildMiddlewareChain('anthropic');
      expect(chain.isEmpty).toBe(true);
    });

    it('should return empty chain for deepseek', () => {
      const chain = buildMiddlewareChain('deepseek');
      expect(chain.isEmpty).toBe(true);
    });
  });
});
