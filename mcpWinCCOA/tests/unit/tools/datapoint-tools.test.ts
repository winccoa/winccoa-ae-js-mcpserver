/**
 * Unit tests for the datapoint tools (get-dpTypes, get-datapoints, get-value,
 * dp-type-name) and pv-range-query, using a mocked WinCC OA manager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerTools as registerBasic } from '../../../src/tools/datapoints/dp_basic.js';
import { registerTools as registerTypes } from '../../../src/tools/datapoints/dp_types.js';
import { registerTools as registerPvRangeQuery } from '../../../src/tools/pv_range/pv_range_query.js';

type Handler = (args: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

/** Register the tools against a fresh mock manager and capture the handlers. */
function setup() {
  const winccoa = {
    dpTypes: vi.fn().mockReturnValue([]),
    dpNames: vi.fn().mockReturnValue([]),
    dpTypeName: vi.fn().mockReturnValue('ExampleType'),
    dpGetDescription: vi.fn().mockReturnValue({ 'en_US.utf8': 'desc' }),
    dpTypeGet: vi.fn().mockReturnValue({ name: 'ExampleType', children: [] }),
    dpGetUnit: vi.fn().mockReturnValue('°C'),
    dpGet: vi.fn(),
    dpExists: vi.fn().mockReturnValue(true)
  };
  const tools = new Map<string, Handler>();
  const server = {
    tool(name: string, _description: string, _schema: unknown, handler: Handler) {
      tools.set(name, handler);
    }
  };
  const context = { winccoa } as any;
  registerBasic(server, context);
  registerTypes(server, context);
  registerPvRangeQuery(server, context);
  return { winccoa, call: async (name: string, args: any) => {
    const result = await tools.get(name)!(args);
    expect(result.content).toHaveLength(1);
    return JSON.parse(result.content[0]!.text);
  } };
}

/** Shape of a WinccoaError. */
function oaError(code: number, message: string, details?: unknown[]): Error {
  return Object.assign(new Error(message), { code, ...(details ? { details } : {}) });
}

/** What the manager throws for a dpGet on a missing datapoint. */
function missingDpError(dp: string): Error {
  return oaError(9399, 'multiple errors (2 errors total)', [
    oaError(71, `DP does not exist, ${dp}:_online.._value`),
    oaError(71, `DP does not exist, ${dp}:_original.._stime`)
  ]);
}

let env: ReturnType<typeof setup>;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  env = setup();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('get-dpTypes', () => {
  it('returns one JSON envelope with type names', async () => {
    env.winccoa.dpTypes.mockReturnValue(['Pump', '_Internal', 'Valve']);
    expect(await env.call('get-dpTypes', {})).toEqual({
      success: true,
      data: { types: ['Pump', 'Valve'], count: 2, withInternals: false }
    });
  });

  it('includes internal types on request', async () => {
    env.winccoa.dpTypes.mockReturnValue(['Pump', '_Internal']);
    const parsed = await env.call('get-dpTypes', { withInternals: true });
    expect(parsed.data).toEqual({ types: ['Pump', '_Internal'], count: 2, withInternals: true });
  });

  it('returns an empty list in the same envelope', async () => {
    expect((await env.call('get-dpTypes', {})).data).toEqual({ types: [], count: 0, withInternals: false });
  });
});

describe('get-datapoints', () => {
  it('returns datapoints and pagination in one envelope', async () => {
    env.winccoa.dpNames.mockReturnValue(['System1:A', 'System1:B', 'System1:C']);
    const parsed = await env.call('get-datapoints', { start: 0, limit: 2 });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ totalCount: 3, start: 0, limit: 2, returnedCount: 2, hasMore: true });
    expect(parsed.data.datapoints).toHaveLength(2);
    expect(parsed.data.datapoints[0]).toEqual({
      name: 'System1:A',
      type: 'ExampleType',
      description: { 'en_US.utf8': 'desc' },
      structure: { name: 'ExampleType', children: [] }
    });
    expect(parsed.metadata).toBeUndefined();
  });

  it('returns an envelope with an empty array when nothing matches', async () => {
    const parsed = await env.call('get-datapoints', { dpNamePattern: 'Nothing*' });
    expect(parsed).toEqual({
      success: true,
      data: { datapoints: [], totalCount: 0, start: 0, limit: 200, returnedCount: 0, hasMore: false }
    });
  });
});

describe('get-value', () => {
  it('keeps the success shape for a single element', async () => {
    env.winccoa.dpGet.mockResolvedValue([21.5, '2026-01-01T00:00:00.000Z']);
    expect((await env.call('get-value', { dpe: 'System1:T.value' })).data).toEqual({
      dpe: 'System1:T.value',
      value: 21.5,
      timestamp: '2026-01-01T00:00:00.000Z',
      unit: '°C'
    });
  });

  it('reports a missing datapoint with the inner code 71 and message', async () => {
    env.winccoa.dpGet.mockRejectedValue(missingDpError('NoSuchDp_XYZ.value'));
    const parsed = await env.call('get-value', { dpe: 'NoSuchDp_XYZ.value' });
    expect(parsed.error).toBe(true);
    expect(parsed.errorCode).toBe(71);
    expect(parsed.errorType).toBe('DP_NOT_EXIST');
    expect(parsed.message).toContain('DP does not exist, NoSuchDp_XYZ.value');
    expect(parsed.message).not.toContain('multiple errors');
    expect(parsed.details).toHaveLength(2);
    expect(parsed.details[0]).toEqual({ code: 71, message: 'DP does not exist, NoSuchDp_XYZ.value:_online.._value' });
  });

  it('reports other errors with their code and details', async () => {
    env.winccoa.dpGet.mockRejectedValue(oaError(54, 'no permission'));
    const parsed = await env.call('get-value', { dpe: 'System1:T.value' });
    expect(parsed).toMatchObject({ error: true, errorCode: 54, message: 'Failed to get values: no permission', details: [] });
  });

  it('shows the inner error per failed element on a partial multi-element read', async () => {
    env.winccoa.dpGet.mockImplementation(async (dpes: string[]) => {
      if (dpes.some(d => d.startsWith('NoSuchDp'))) {
        throw dpes.length > 2 ? oaError(9399, 'multiple errors (2 errors total)') : missingDpError('NoSuchDp.value');
      }
      return [1, 'ts'];
    });
    const parsed = await env.call('get-value', { dpe: ['System1:T.value', 'NoSuchDp.value'] });
    expect(parsed.success).toBe(true);
    expect(parsed.data.partial).toBe(true);
    expect(parsed.data.values).toEqual([{ dpe: 'System1:T.value', value: 1, timestamp: 'ts', unit: '°C' }]);
    expect(parsed.data.failures).toHaveLength(1);
    expect(parsed.data.failures[0].dpe).toBe('NoSuchDp.value');
    expect(parsed.data.failures[0].errorCode).toBe(71);
    expect(parsed.data.failures[0].error).toContain('DP does not exist, NoSuchDp.value');
  });

  it('reports inner errors when every element of a multi-element read fails', async () => {
    env.winccoa.dpGet.mockImplementation(async (dpes: string[]) => {
      throw missingDpError(dpes[0]!.split(':')[0]!);
    });
    const parsed = await env.call('get-value', { dpe: ['A.value', 'B.value'] });
    expect(parsed.error).toBe(true);
    expect(parsed.errorCode).toBe(71);
    expect(parsed.errorType).toBe('DP_NOT_EXIST');
    expect(parsed.failures.map((f: any) => f.errorCode)).toEqual([71, 71]);
    expect(parsed.message).toContain('DP does not exist');
  });
});

describe('dp-type-name', () => {
  it('returns dpName and typeName', async () => {
    expect(await env.call('dp-type-name', { dpName: 'Valve17.opening' })).toEqual({
      success: true,
      data: { dpName: 'Valve17.opening', typeName: 'ExampleType' }
    });
  });

  it('returns an error envelope for a missing datapoint', async () => {
    env.winccoa.dpTypeName.mockImplementation(() => { throw oaError(71, 'DP does not exist'); });
    expect((await env.call('dp-type-name', { dpName: 'Nope' })).error).toBe(true);
    env.winccoa.dpTypeName.mockReturnValue('');
    expect(await env.call('dp-type-name', { dpName: 'Nope' })).toMatchObject({ error: true, errorType: 'DP_NOT_EXIST' });
  });
});

describe('pv-range-query', () => {
  const attribute = (dpe: string) => dpe.split(':_pv_range.._')[1];

  it('treats code 19 on _type as not configured, without an error log', async () => {
    env.winccoa.dpGet.mockRejectedValue(oaError(19, 'attribute does not exist in this config'));
    const parsed = await env.call('pv-range-query', { dpe: 'System1:T.' });
    expect(parsed.data).toMatchObject({ dpe: 'System1:T.', configured: false });
    expect(console.error).not.toHaveBeenCalled();
    // Only the type is read when there is no config.
    expect(env.winccoa.dpGet).toHaveBeenCalledTimes(1);
  });

  it('treats a 9399 whose details are all code 19 as not configured', async () => {
    env.winccoa.dpGet.mockRejectedValue(
      oaError(9399, 'multiple errors', [oaError(19, 'attribute does not exist'), oaError(19, 'attribute does not exist')])
    );
    expect((await env.call('pv-range-query', { dpe: 'System1:T.' })).data.configured).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('returns configured:false for DPCONFIG_NONE without reading the other attributes', async () => {
    env.winccoa.dpGet.mockResolvedValue(0);
    expect((await env.call('pv-range-query', { dpe: 'System1:T.' })).data.configured).toBe(false);
    expect(env.winccoa.dpGet).toHaveBeenCalledTimes(1);
  });

  it('returns the configuration when one exists', async () => {
    const values: Record<string, unknown> = { type: 7, min: 0, max: 100, incl_min: true, incl_max: false };
    env.winccoa.dpGet.mockImplementation(async (dpe: string) => values[attribute(dpe)!]);
    expect((await env.call('pv-range-query', { dpe: 'System1:T.' })).data).toEqual({
      dpe: 'System1:T.', type: 7, min: 0, max: 100, includeMin: true, includeMax: false, configured: true
    });
  });

  it('omits attributes the configured range type does not have', async () => {
    env.winccoa.dpGet.mockImplementation(async (dpe: string) => {
      if (attribute(dpe) === 'type') return 8;
      throw oaError(19, 'attribute does not exist in this config');
    });
    const parsed = await env.call('pv-range-query', { dpe: 'System1:T.' });
    expect(parsed.data).toEqual({ dpe: 'System1:T.', type: 8, configured: true });
  });

  it('returns an error envelope for real failures', async () => {
    env.winccoa.dpGet.mockRejectedValue(oaError(54, 'no permission'));
    const parsed = await env.call('pv-range-query', { dpe: 'System1:T.' });
    expect(parsed).toMatchObject({ error: true, errorCode: 54 });
    expect(parsed.message).toContain('no permission');
  });
});
