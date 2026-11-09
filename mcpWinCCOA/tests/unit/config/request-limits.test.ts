/**
 * GHSA-46jr-4wx8-v453: tool input element cap and request body cap.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import {
  DEFAULT_MAX_TOOL_INPUT_ELEMENTS,
  DEFAULT_MAX_REQUEST_BODY_BYTES,
  parseByteSize,
  parseElementLimit,
  resolveRequestLimits
} from '../../../src/config/limits.js';

describe('resolveRequestLimits', () => {
  it('uses the defaults when unset or blank', () => {
    for (const env of [{}, { MCP_MAX_TOOL_INPUT_ELEMENTS: '', MCP_MAX_REQUEST_BODY: ' ' }]) {
      const l = resolveRequestLimits(env as NodeJS.ProcessEnv);
      expect(l.maxToolInputElements).toBe(DEFAULT_MAX_TOOL_INPUT_ELEMENTS);
      expect(l.maxRequestBodyBytes).toBe(DEFAULT_MAX_REQUEST_BODY_BYTES);
      expect(l.errors).toEqual([]);
    }
    expect(DEFAULT_MAX_TOOL_INPUT_ELEMENTS).toBe(1000);
    expect(DEFAULT_MAX_REQUEST_BODY_BYTES).toBe(1048576);
  });

  it('parses valid overrides', () => {
    const l = resolveRequestLimits({
      MCP_MAX_TOOL_INPUT_ELEMENTS: '250',
      MCP_MAX_REQUEST_BODY: '2mb'
    } as NodeJS.ProcessEnv);
    expect(l.maxToolInputElements).toBe(250);
    expect(l.maxRequestBodyBytes).toBe(2 * 1024 * 1024);
    expect(l.errors).toEqual([]);
  });

  it('reports invalid values, keeps the default and never disables the limit', () => {
    for (const bad of ['0', '-5', '1.5', 'abc', 'Infinity', '1e3']) {
      const l = resolveRequestLimits({ MCP_MAX_TOOL_INPUT_ELEMENTS: bad } as NodeJS.ProcessEnv);
      expect(l.errors).toHaveLength(1);
      expect(l.errors[0]).toContain('MCP_MAX_TOOL_INPUT_ELEMENTS');
      expect(l.maxToolInputElements).toBe(DEFAULT_MAX_TOOL_INPUT_ELEMENTS);
    }
    const b = resolveRequestLimits({ MCP_MAX_REQUEST_BODY: 'lots' } as NodeJS.ProcessEnv);
    expect(b.errors[0]).toContain('MCP_MAX_REQUEST_BODY');
    expect(b.maxRequestBodyBytes).toBe(DEFAULT_MAX_REQUEST_BODY_BYTES);
  });

  it('parseByteSize handles bytes, kb and mb', () => {
    expect(parseByteSize('100')).toBe(100);
    expect(parseByteSize('512KB')).toBe(512 * 1024);
    expect(parseByteSize('1 mb')).toBe(1024 * 1024);
    expect(parseByteSize('0')).toBeUndefined();
    expect(parseByteSize('1gb')).toBeUndefined();
    expect(parseElementLimit('12')).toBe(12);
  });
});

async function callWithLimit(limit: number, count: number) {
  const server = new McpServer(
    { name: 't', version: '1' },
    { maxToolInputElements: limit }
  );
  server.tool('echo', { items: z.array(z.string()) }, async ({ items }) => ({
    content: [{ type: 'text' as const, text: String(items.length) }]
  }));
  const client = new Client({ name: 'c', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    return await client.callTool({
      name: 'echo',
      arguments: { items: Array.from({ length: count }, (_, i) => `d${i}`) }
    });
  } finally {
    await client.close();
  }
}

describe('McpServer maxToolInputElements', () => {
  // elements = array entries + the "items" key
  it('accepts input exactly at the limit', async () => {
    const r: any = await callWithLimit(11, 10);
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toBe('10');
  });

  it('rejects input one element over the limit', async () => {
    const r: any = await callWithLimit(11, 11);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/maximum of 11 elements/);
  });
});

describe('createServer applies the configured limit', () => {
  afterEach(() => {
    delete process.env.MCP_MAX_TOOL_INPUT_ELEMENTS;
    vi.resetModules();
  });

  it('throws on an invalid MCP_MAX_TOOL_INPUT_ELEMENTS instead of disabling the cap', async () => {
    process.env.MCP_MAX_TOOL_INPUT_ELEMENTS = 'nope';
    delete process.env.TOOLS;
    const { initContext, createServer } = await import('../../../src/server.js');
    const ctx = await initContext();
    await expect(createServer(ctx)).rejects.toThrow(/MCP_MAX_TOOL_INPUT_ELEMENTS/);
  });
});
