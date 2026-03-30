/**
 * CurrentTimeTool — 获取用户当前的精确时间
 *
 * Agent 通过此工具获知用户所在时区的当前日期和时间。
 * 这是一个无参数的轻量级工具，Agent 在需要时间信息时应主动调用。
 *
 * 原始实现：lib/agent/tools/utility/current_time_tool.dart
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

export class CurrentTimeTool extends AgentTool<typeof currentTimeParams> {
  readonly name = 'current_time';

  readonly description =
    "Get the current date and time in the user's local timezone. " +
    'Call this tool when you need to know the exact current time, ' +
    'such as before writing diary entries, scheduling events, ' +
    'or when the user asks "what time is it".';

  readonly parameters = currentTimeParams;

  async execute(_args: z.infer<typeof currentTimeParams>, _context: ToolContext): Promise<string> {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    const weekday = WEEKDAYS[now.getDay()]!;

    const tzOffset = -now.getTimezoneOffset();
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');

    return (
      `Current time: ${year}-${month}-${day} ${hour}:${minute}:${second} (${weekday})\n` +
      `Timezone: UTC${tzSign}${tzHours}:${tzMinutes}`
    );
  }
}

const currentTimeParams = z.object({});
