import { describe, it, expect } from 'vitest';
import { CurrentTimeTool } from '../tools/current-time.tool';

describe('CurrentTimeTool', () => {
  const tool = new CurrentTimeTool();

  it('should have the correct name and description', () => {
    expect(tool.name).toBe('current_time');
    expect(tool.description).toContain('current');
    expect(tool.description.toLowerCase()).toContain('time');
  });

  it('should return formatted date and timezone info', async () => {
    const result = await tool.execute({}, { sessionId: 's1', vaultName: '/tmp' });

    expect(result).toContain('Current Date and Time:');
    expect(result).toContain('Timezone: UTC');
    // 应包含星期几
    expect(result).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    // 应包含年份
    expect(result).toContain('Year:');
  });

  it('should produce a valid Vercel CoreTool via toVercelTool', () => {
    const coreTool = tool.toVercelTool({ sessionId: 's1', vaultName: '/tmp' });
    expect(coreTool).toBeDefined();
  });
});
