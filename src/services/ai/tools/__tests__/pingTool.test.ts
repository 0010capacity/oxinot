import { describe, it, expect } from 'vitest';
import { pingTool } from '../examples/pingTool';
import { toolToAIFunction } from '../utils';

describe('Tool System', () => {
  it('should execute ping tool successfully', async () => {
    const result = await pingTool.execute({ message: 'hello' }, { workspacePath: '/test' });
    expect(result.success).toBe(true);
    expect(result.data).toBe('pong: hello');
  });

  it('should convert tool to AI function format', () => {
    const aiFunction = toolToAIFunction(pingTool);
    expect(aiFunction.name).toBe('ping');
    expect(aiFunction.description).toBeDefined();
    expect(aiFunction.parameters).toHaveProperty('type', 'object');
  });
});
