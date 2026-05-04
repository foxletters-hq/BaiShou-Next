import { TextStreamPart } from 'ai';
import { logger } from '@baishou/shared';

export interface ToolCallSnapshot {
  callId: string;
  name: string;
  arguments: string;
}

export interface ToolResultSnapshot {
  callId: string;
  result: any;
}

export class StreamAccumulator {
  private _textBuffer: string = '';
  private _reasoningBuffer: string = '';
  
  // 用于 tracking token
  private _inputTokens: number = 0;
  private _outputTokens: number = 0;

  // 使用 Map 是为了流式不断累加时去查找
  private _toolCalls: Map<string, ToolCallSnapshot> = new Map();
  private _toolResults: Map<string, ToolResultSnapshot> = new Map();

  /**
   * 纯文本内容（用于发送给 UI 或者最终落盘时作为 text Part）
   */
  get text(): string {
    return this._textBuffer;
  }

  /**
   * 深度思考过程（R1等大模型的思维链过程）
   */
  get reasoning(): string {
    return this._reasoningBuffer;
  }

  get toolCalls(): ToolCallSnapshot[] {
    return Array.from(this._toolCalls.values());
  }

  get toolResults(): ToolResultSnapshot[] {
    return Array.from(this._toolResults.values());
  }
  
  get usage() {
    return {
      inputTokens: this._inputTokens,
      outputTokens: this._outputTokens
    };
  }

  /**
   * 处理从 AI SDK 传回的原生 TextStreamPart 碎片
   */
  add(part: TextStreamPart<any>): void {
    const p = part as any;
    switch (p.type) {
      case 'text-delta': {
        if (p.textDelta) {
          this._textBuffer += p.textDelta;
        } else if (p.text) {
          this._textBuffer += p.text;
        }
        break;
      }
      
      case 'reasoning-delta': {
        if (p.textDelta) {
          this._reasoningBuffer += p.textDelta;
        } else if (p.text) {
          this._reasoningBuffer += p.text;
        }
        break;
      }
      
      case 'tool-call': {
        if (p.toolCallId) {
          const legacyArgs = p.args ?? p.providerMetadata?.raw?.input;
          const inputArgs = typeof p.input === 'string' 
            ? p.input 
            : JSON.stringify(p.input ?? legacyArgs ?? {});

          this._toolCalls.set(p.toolCallId, {
            callId: p.toolCallId,
            name: p.toolName || '',
            arguments: inputArgs,
          });
        }
        break;
      }
      
      case 'tool-result': {
        if (p.toolCallId) {
          const res = p.output ?? p.result ?? p.providerMetadata?.raw;
          this._toolResults.set(p.toolCallId, {
            callId: p.toolCallId,
            result: res,
          });
        }
        break;
      }
      
      case 'finish': {
        if (p.usage) {
           this._inputTokens = p.usage.promptTokens || p.usage.inputTokens || 0;
           this._outputTokens = p.usage.completionTokens || p.usage.outputTokens || 0;
           logger.info('[StreamAccumulator] Finish chunk usage parsed:', this._inputTokens, this._outputTokens);
        } else if (p.totalUsage) {
           this._inputTokens = p.totalUsage.promptTokens || p.totalUsage.inputTokens || 0;
           this._outputTokens = p.totalUsage.completionTokens || p.totalUsage.outputTokens || 0;
           logger.info('[StreamAccumulator] Finish chunk totalUsage parsed:', this._inputTokens, this._outputTokens);
        } else {
           logger.info('[StreamAccumulator] Finish chunk received but NO usage data found:', JSON.stringify(p));
        }
        break;
      }
      
      default:
        // if some unknown chunk has usage, log it
        if ((part as any).usage || (part as any).usageMetadata || (part as any).providerMetadata) {
            logger.info('[StreamAccumulator] Unknown chunk with potential usage metadata:', JSON.stringify(part));
        }
        break;
    }
  }
}
