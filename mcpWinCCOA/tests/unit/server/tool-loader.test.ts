/**
 * Unit tests for src/tool_loader.ts and the icon tool module's registration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAllTools, resetToolLoaderLogState } from '../../../src/tool_loader.js';

const savedTools = process.env.TOOLS;
const savedLevel = process.env.MCP_LOG_LEVEL;
const savedProj = process.env.WINCCOA_PROJ_PATH;

/** Minimal MCP server stand-in that records registered tool names. */
function fakeServer() {
  const names: string[] = [];
  return { names, tool: (name: string) => { names.push(name); } };
}

const context = { winccoa: {} } as any;

beforeEach(() => {
  resetToolLoaderLogState();
  delete process.env.MCP_LOG_LEVEL;
  process.env.WINCCOA_PROJ_PATH = '/tmp/mcp-test-project';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries({ TOOLS: savedTools, MCP_LOG_LEVEL: savedLevel, WINCCOA_PROJ_PATH: savedProj })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('loadAllTools', () => {
  it('counts the modules that actually registered', async () => {
    process.env.TOOLS = 'datapoints/dp_basic,does/not_exist,icons/icon';
    const server = fakeServer();
    const summary = await loadAllTools(server, context);

    expect(summary.configuredModules).toBe(3);
    expect(summary.loadedModules).toBe(2);
    expect(summary.totalTools).toBe(7);
    expect(summary.failedModules.map(f => f.module)).toEqual(['does/not_exist']);
    expect(server.names).toContain('get-value');
    expect(server.names).toContain('create-custom-icon');

    const infoLines = vi.mocked(console.log).mock.calls.map(c => String(c[0]));
    expect(infoLines.some(l => l.includes('Registered 7 tools from 2 of 3 modules') && l.includes('does/not_exist'))).toBe(true);
  });

  it('reports a failing module once per process, not on every request', async () => {
    process.env.TOOLS = 'does/not_exist';
    await loadAllTools(fakeServer(), context);
    await loadAllTools(fakeServer(), context);
    await loadAllTools(fakeServer(), context);

    const failures = vi.mocked(console.error).mock.calls.filter(c => String(c[0]).includes('Failed to load does/not_exist'));
    expect(failures).toHaveLength(1);
  });

  it('registers the icon tools even when the project path is unknown', async () => {
    delete process.env.WINCCOA_PROJ_PATH;
    const savedPvss = process.env.PVSS_II;
    delete process.env.PVSS_II;
    try {
      process.env.TOOLS = 'icons/icon';
      const server = fakeServer();
      const summary = await loadAllTools(server, context);
      expect(summary.loadedModules).toBe(1);
      expect(summary.failedModules).toEqual([]);
      expect(server.names).toEqual(['create-custom-icon', 'list-custom-icons', 'delete-custom-icon', 'list-ix-icons']);
    } finally {
      if (savedPvss !== undefined) process.env.PVSS_II = savedPvss;
    }
  });
});
