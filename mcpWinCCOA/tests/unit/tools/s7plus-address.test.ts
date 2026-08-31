/**
 * Unit tests for src/tools/s7plus/s7plus_address.ts
 *
 * Tests:
 *  - Zod schema validation for the S7Plus address tool
 *  - Handler behavior: correct response structure on success and error
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock S7PlusConnection so tool handlers never touch WinCC OA
// ---------------------------------------------------------------------------

const mockAddAddressConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);

vi.mock('../../../src/helpers/drivers/S7PlusConnection.js', () => ({
  S7PlusConnection: vi.fn().mockImplementation(() => ({
    addAddressConfig: mockAddAddressConfig
  }))
}));

import { registerTools } from '../../../src/tools/s7plus/s7plus_address.js';

// ---------------------------------------------------------------------------
// Mock server that captures tool registrations
// ---------------------------------------------------------------------------

type CapturedTool = {
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (...args: any[]) => any;
};

const capturedTools = new Map<string, CapturedTool>();

const mockServer = {
  tool(name: string, description: string, schema: z.ZodRawShape, handler: (...args: any[]) => any) {
    capturedTools.set(name, { description, schema: z.object(schema), handler });
  }
};

beforeAll(() => {
  registerTools(mockServer as any, {} as any);
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-add-address-config
// ---------------------------------------------------------------------------

describe('s7plus-add-address-config schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-add-address-config')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a minimal valid input', () => {
    expect(schema.safeParse({
      dpeName: 'MyDevice.Temperature.Value',
      reference: 'MyDB.MyVar',
      mode: 'Polling',
      driverNumber: 4,
      connectionName: '_S7PlusConnection1'
    }).success).toBe(true);
  });

  it('accepts a fully specified input', () => {
    expect(schema.safeParse({
      dpeName: 'MyDevice.Temperature.Value',
      reference: 'MyDB.MyVar',
      mode: 'Subscription',
      driverNumber: 4,
      connectionName: '_S7PlusConnection1',
      transformation: 1015,
      oldNewComparison: true,
      itemLength: 50,
      pollGroup: '_S7Plus_Subscr',
      pollInterval: 500,
      onlyChanges: true
    }).success).toBe(true);
  });

  it('accepts all valid modes', () => {
    const modes = ['Polling', 'Subscription', 'Output', 'SingleRead', 'InputPoll', 'SingleWrite', 'IOSingleQuery'];
    for (const mode of modes) {
      expect(schema.safeParse({
        dpeName: 'dp.val', reference: 'DB.Tag', mode,
        driverNumber: 1, connectionName: 'conn1'
      }).success).toBe(true);
    }
  });

  it('rejects invalid mode', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Invalid',
      driverNumber: 1, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects when dpeName is missing', () => {
    expect(schema.safeParse({
      reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects when reference is missing', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects when mode is missing', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag',
      driverNumber: 1, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects when driverNumber is missing', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1
    }).success).toBe(false);
  });

  it('rejects driverNumber=0 (below minimum 1)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 0, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('rejects driverNumber=100 (above maximum 99)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 100, connectionName: 'conn1'
    }).success).toBe(false);
  });

  it('accepts driverNumber=99 (boundary max)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 99, connectionName: 'conn1'
    }).success).toBe(true);
  });

  it('rejects transformation=1000 (below minimum 1001)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1', transformation: 1000
    }).success).toBe(false);
  });

  it('rejects transformation=1028 (above maximum 1027)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1', transformation: 1028
    }).success).toBe(false);
  });

  it('accepts transformation=1001 (boundary min)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1', transformation: 1001
    }).success).toBe(true);
  });

  it('accepts transformation=1027 (boundary max)', () => {
    expect(schema.safeParse({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1', transformation: 1027
    }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-add-address-config
// ---------------------------------------------------------------------------

describe('s7plus-add-address-config handler', () => {
  beforeEach(() => {
    mockAddAddressConfig.mockResolvedValue(undefined);
  });

  it('returns success response with address details', async () => {
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'MyDevice.Temperature.Value',
      reference: 'MyDB.MyVar',
      mode: 'Polling',
      driverNumber: 4,
      connectionName: '_S7PlusConnection1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.dpeName).toBe('MyDevice.Temperature.Value');
    expect(parsed.data.reference).toBe('MyDB.MyVar');
    expect(parsed.data.mode).toBe('Polling');
    expect(parsed.data.direction).toBe(7);
    expect(parsed.data.driverNumber).toBe(4);
  });

  it('maps Subscription mode to direction 7', async () => {
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Subscription',
      driverNumber: 1, connectionName: 'conn1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.direction).toBe(7);
  });

  it('maps Output mode to direction 1', async () => {
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Output',
      driverNumber: 1, connectionName: 'conn1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.direction).toBe(1);
  });

  it('maps SingleRead mode to direction 3', async () => {
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'SingleRead',
      driverNumber: 1, connectionName: 'conn1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.direction).toBe(3);
  });

  it('maps IOSingleQuery mode to direction 8', async () => {
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'IOSingleQuery',
      driverNumber: 1, connectionName: 'conn1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data.direction).toBe(8);
  });

  it('returns error response when addAddressConfig throws', async () => {
    mockAddAddressConfig.mockRejectedValue(new Error('Datapoint not found'));
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    const result = await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Polling',
      driverNumber: 1, connectionName: 'conn1'
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Datapoint not found');
  });

  it('calls addAddressConfig with onlyChanges for Subscription mode', async () => {
    mockAddAddressConfig.mockResolvedValue(undefined);
    const handler = capturedTools.get('s7plus-add-address-config')!.handler;
    await handler({
      dpeName: 'dp.val', reference: 'DB.Tag', mode: 'Subscription',
      driverNumber: 1, connectionName: 'conn1'
    });

    expect(mockAddAddressConfig).toHaveBeenCalledWith(
      expect.objectContaining({ onlyChanges: true })
    );
  });
});

// ---------------------------------------------------------------------------
// Tool registration count
// ---------------------------------------------------------------------------

describe('S7Plus address tool registration', () => {
  it('registers s7plus-add-address-config tool', () => {
    expect(capturedTools.has('s7plus-add-address-config')).toBe(true);
  });

  it('registerTools returns 1', () => {
    const fresh = new Map<string, CapturedTool>();
    const freshServer = {
      tool(name: string, desc: string, schema: z.ZodRawShape, handler: (...args: any[]) => any) {
        fresh.set(name, { description: desc, schema: z.object(schema), handler });
      }
    };
    const count = registerTools(freshServer as any, {} as any);
    expect(count).toBe(1);
  });
});
