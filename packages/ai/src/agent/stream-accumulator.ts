import { TextStreamPart } from 'ai';

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
    switch (part.type) {
      case 'text-delta': {
        if (part.text) {
          this._textBuffer += part.text;
        }
        break;
      }
      
      case 'reasoning-delta': {
        if (part.text) {
          this._reasoningBuffer += part.text;
        }
        break;
      }
      
      case 'tool-call': {
        if (part.toolCallId) {
          const legacyArgs = (part as any).args ?? (part as any).providerMetadata?.raw?.input;
          const inputArgs = typeof part.input === 'string' 
            ? part.input 
            : JSON.stringify(part.input ?? legacyArgs ?? {});

          this._toolCalls.set(part.toolCallId, {
            callId: part.toolCallId,
            name: part.toolName || '',
            arguments: inputArgs,
          });
        }
        break;
      }
      
      case 'tool-result': {
        if (part.toolCallId) {
          const res = part.output ?? (part as any).result ?? (part as any).providerMetadata?.raw;
          this._toolResults.set(part.toolCallId, {
            callId: part.toolCallId,
            result: res,
          });
        }
        break;
      }
      
      case 'finish': {
        // AI SDK 的 finish 提供全流程 Usage 统计
        if (part.usage) {
           this._inputTokens = part.usage.promptTokens || 0;
           this._outputTokens = part.usage.completionTokens || 0;
        } else if (part.totalUsage) {
           this._inputTokens = part.totalUsage.promptTokens || 0;
           this._outputTokens = part.totalUsage.completionTokens || 0;
        }
        break;
      }
      
      default:
        break;
    }
  }
}
