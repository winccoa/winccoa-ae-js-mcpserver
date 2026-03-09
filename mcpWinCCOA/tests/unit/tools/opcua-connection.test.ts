/**
 * Unit tests for src/tools/opcua/opcua_connection.ts
 *
 * Tests:
 *  - Zod schema validation for all three OPC UA tools
 *  - Handler behavior: correct response structure on success and error
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock OpcUaConnection so tool handlers never touch WinCC OA or Pmon
// ---------------------------------------------------------------------------

const mockAddConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue('_OpcUAConnection1')
);
const mockBrowse = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    nodes: [{ displayName: 'TestNode', nodeId: 'ns=2;s=Test', nodeClass: 'Variable', hasChildren: false }],
    totalNodes: 1,
    isPartial: false
  })
);
const mockDeleteConnection = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../../../src/helpers/drivers/OpcUaConnection.js', () => ({
  OpcUaConnection: vi.fn().mockImplementation(() => ({
    addConnection: mockAddConnection,
    browse: mockBrowse,
    deleteConnection: mockDeleteConnection,
    addAddressConfig: vi.fn().mockResolvedValue(true)
  }))
}));

import { registerTools } from '../../../src/tools/opcua/opcua_connection.js';

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
// Schema tests: opcua-add-connection
// ---------------------------------------------------------------------------

describe('opcua-add-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('opcua-add-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a minimal valid input', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', port: 4840, managerNumber: 4 }).success).toBe(true);
  });

  it('accepts a fully specified valid input', () => {
    expect(schema.safeParse({
      ipAddress: '192.168.1.100', port: 4840, managerNumber: 4,
      reconnectTimer: 30, securityPolicy: 4, messageSecurityMode: 2,
      username: 'admin', password: 'secret', clientCertificate: 'client.pem',
      separator: '.', enableConnection: true
    }).success).toBe(true);
  });

  it('rejects when ipAddress is missing', () => {
    expect(schema.safeParse({ port: 4840, managerNumber: 4 }).success).toBe(false);
  });

  it('rejects port=0 (below minimum 1)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 0, managerNumber: 4 }).success).toBe(false);
  });

  it('rejects port=65536 (above maximum 65535)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 65536, managerNumber: 4 }).success).toBe(false);
  });

  it('accepts port=65535 (boundary max)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 65535, managerNumber: 4 }).success).toBe(true);
  });

  it('accepts port=1 (boundary min)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 1, managerNumber: 4 }).success).toBe(true);
  });

  it('rejects managerNumber=0 (below minimum 1)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 4840, managerNumber: 0 }).success).toBe(false);
  });

  it('rejects managerNumber=100 (above maximum 99)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 4840, managerNumber: 100 }).success).toBe(false);
  });

  it('accepts managerNumber=99 (boundary max)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 4840, managerNumber: 99 }).success).toBe(true);
  });

  it('rejects securityPolicy > 6', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 4840, managerNumber: 4, securityPolicy: 7 }).success).toBe(false);
  });

  it('rejects messageSecurityMode > 2', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.1', port: 4840, managerNumber: 4, messageSecurityMode: 3 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: opcua-add-connection
// ---------------------------------------------------------------------------

describe('opcua-add-connection handler', () => {
  beforeAll(() => {
    mockAddConnection.mockClear();
  });

  it('returns a success response with connectionName on success', async () => {
    mockAddConnection.mockResolvedValueOnce('_OpcUAConnection1');
    const handler = capturedTools.get('opcua-add-connection')!.handler;
    const result = await handler({ ipAddress: '192.168.1.100', port: 4840, managerNumber: 4 });

    expect(result.content).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_OpcUAConnection1');
    expect(parsed.data.serverUrl).toBe('opc.tcp://192.168.1.100:4840');
    expect(parsed.data.managerNumber).toBe(4);
  });

  it('calls addConnection with the supplied params', async () => {
    mockAddConnection.mockResolvedValueOnce('_OpcUAConnection2');
    const handler = capturedTools.get('opcua-add-connection')!.handler;
    await handler({ ipAddress: '10.0.0.1', port: 4840, managerNumber: 5, securityPolicy: 4 });

    expect(mockAddConnection).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '10.0.0.1', port: 4840, managerNumber: 5, securityPolicy: 4 })
    );
  });

  it('returns an error response when addConnection throws', async () => {
    mockAddConnection.mockRejectedValueOnce(new Error('Driver not running'));
    const handler = capturedTools.get('opcua-add-connection')!.handler;
    const result = await handler({ ipAddress: '192.168.1.100', port: 4840, managerNumber: 4 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Driver not running');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: opcua-browse
// ---------------------------------------------------------------------------

describe('opcua-browse schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('opcua-browse')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts minimal input with just connectionName', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1' }).success).toBe(true);
  });

  it('accepts full valid input', () => {
    expect(schema.safeParse({
      connectionName: '_OpcUAConnection1', parentNodeId: 'ns=0;i=85',
      eventSource: 0, depth: 2, offset: 0, limit: 100, useCache: true, refreshCache: false
    }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('rejects depth=0 (below minimum 1)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', depth: 0 }).success).toBe(false);
  });

  it('rejects depth=6 (above maximum 5)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', depth: 6 }).success).toBe(false);
  });

  it('accepts depth=5 (boundary max)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', depth: 5 }).success).toBe(true);
  });

  it('rejects limit > 800', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', limit: 801 }).success).toBe(false);
  });

  it('accepts limit=800 (boundary max)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', limit: 800 }).success).toBe(true);
  });

  it('accepts eventSource as string "0", "1", or "2"', () => {
    expect(schema.safeParse({ connectionName: 'c', eventSource: '0' }).success).toBe(true);
    expect(schema.safeParse({ connectionName: 'c', eventSource: '1' }).success).toBe(true);
    expect(schema.safeParse({ connectionName: 'c', eventSource: '2' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: opcua-browse
// ---------------------------------------------------------------------------

describe('opcua-browse handler', () => {
  it('returns a success response with node data on success', async () => {
    const handler = capturedTools.get('opcua-browse')!.handler;
    const result = await handler({ connectionName: '_OpcUAConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_OpcUAConnection1');
    expect(parsed.data.nodes).toHaveLength(1);
  });

  it('returns error response when browse throws', async () => {
    mockBrowse.mockRejectedValueOnce(new Error('Connection not active'));
    const handler = capturedTools.get('opcua-browse')!.handler;
    const result = await handler({ connectionName: '_OpcUAConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection not active');
  });

  it('returns error response when invalid depth is provided in handler', async () => {
    // depth=0 is rejected by the handler itself (additional validation beyond schema)
    const handler = capturedTools.get('opcua-browse')!.handler;
    // Pass depth=0 directly to handler (bypassing schema since handler re-validates)
    const result = await handler({ connectionName: '_OpcUAConnection1', depth: 0 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema tests: opcua-delete-connection
// ---------------------------------------------------------------------------

describe('opcua-delete-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('opcua-delete-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a valid connectionName', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1' }).success).toBe(true);
  });

  it('accepts with optional managerNumber', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', managerNumber: 4 }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('rejects managerNumber=0 (below minimum 1)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', managerNumber: 0 }).success).toBe(false);
  });

  it('rejects managerNumber=100 (above maximum 99)', () => {
    expect(schema.safeParse({ connectionName: '_OpcUAConnection1', managerNumber: 100 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: opcua-delete-connection
// ---------------------------------------------------------------------------

describe('opcua-delete-connection handler', () => {
  it('returns success response on successful deletion', async () => {
    mockDeleteConnection.mockResolvedValueOnce(true);
    const handler = capturedTools.get('opcua-delete-connection')!.handler;
    const result = await handler({ connectionName: '_OpcUAConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_OpcUAConnection1');
  });

  it('returns error response when deleteConnection throws', async () => {
    mockDeleteConnection.mockRejectedValueOnce(new Error('Connection not found'));
    const handler = capturedTools.get('opcua-delete-connection')!.handler;
    const result = await handler({ connectionName: '_OpcUAConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection not found');
  });
});

// ---------------------------------------------------------------------------
// Tool registration count
// ---------------------------------------------------------------------------

describe('OPC UA tool registration', () => {
  it('registers exactly 3 tools', () => {
    for (const name of ['opcua-add-connection', 'opcua-browse', 'opcua-delete-connection']) {
      expect(capturedTools.has(name)).toBe(true);
    }
  });

  it('registerTools returns 3', () => {
    const fresh = new Map<string, CapturedTool>();
    const freshServer = {
      tool(name: string, desc: string, schema: z.ZodRawShape, handler: (...args: any[]) => any) {
        fresh.set(name, { description: desc, schema: z.object(schema), handler });
      }
    };
    const count = registerTools(freshServer as any, {} as any);
    expect(count).toBe(3);
  });
});
