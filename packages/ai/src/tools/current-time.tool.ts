import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const currentTimeParams = z.object({});

export class CurrentTimeTool extends AgentTool<typeof currentTimeParams> {
  readonly name = 'current_time';

  readonly description =
    'Get the current real-world time, date, and day of the week. ' +
    'Very useful for answering questions related to time calculations, age, absolute dates, etc.';

  readonly parameters = currentTimeParams;

  async execute(
    _args: z.infer<typeof currentTimeParams>,
    _context: ToolContext,
  ): Promise<string> {
    const now = new Date();
    
    const tzOffset = -now.getTimezoneOffset() / 60;
    const tzSign = tzOffset >= 0 ? '+' : '';
    
    // YYYY-MM-DD HH:mm:ss
    const dateStr = 
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')} ` +
      `${String(now.getHours()).padStart(2, '0')}:` +
      `${String(now.getMinutes()).padStart(2, '0')}:` +
      `${String(now.getSeconds()).padStart(2, '0')}`;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[now.getDay()];

    return `Current Date and Time: ${dateStr}\nTimezone: UTC${tzSign}${tzOffset}\nDay of week: ${dayOfWeek}\nYear: ${now.getFullYear()}`;
  }
}
