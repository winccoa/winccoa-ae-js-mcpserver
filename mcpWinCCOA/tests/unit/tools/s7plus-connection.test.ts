/**
 * Unit tests for src/tools/s7plus/s7plus_connection.ts
 *
 * Tests:
 *  - Zod schema validation for all S7Plus connection tools
 *  - Handler behavior: correct response structure on success and error
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock S7PlusConnection so tool handlers never touch WinCC OA or Pmon
// ---------------------------------------------------------------------------

const mockAddConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, connectionName: '_S7PlusConnection1' })
);
const mockUpdateConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
);
const mockDeleteConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
);
const mockListConnections = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, connections: [] })
);
const mockGetConnectionState = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, state: 3, stateName: 'Connected' })
);
const mockBrowse = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    nodes: [{ displayName: 'TestNode', path: 'TestNode', hasChildren: false }],
    totalNodes: 1,
    isPartial: false
  })
);
const mockListCaCertificates = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, certificates: ['ca.pem'] })
);
const mockAddCaCertificates = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, added: ['new-ca.pem'], alreadyPresent: [] })
);
const mockRemoveCaCertificates = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, removed: ['old-ca.pem'], notFound: [] })
);
const mockDiscoverTiaProjects = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, tiaProjects: [], message: 'No TIA projects found' })
);

vi.mock('../../../src/helpers/drivers/S7PlusConnection.js', () => ({
  S7PlusConnection: vi.fn().mockImplementation(() => ({
    addConnection: mockAddConnection,
    updateConnection: mockUpdateConnection,
    deleteConnection: mockDeleteConnection,
    listConnections: mockListConnections,
    getConnectionState: mockGetConnectionState,
    browse: mockBrowse,
    listCaCertificates: mockListCaCertificates,
    addCaCertificates: mockAddCaCertificates,
    removeCaCertificates: mockRemoveCaCertificates,
    discoverTiaProjects: mockDiscoverTiaProjects
  })),
  S7PlusPlcType: {
    Automatic: 1, RH: 2, RH_Single: 3,
    S7_1500: 16, S7_1200: 272, S7_1500_SoftCtrl: 528, PLCSim: 768
  }
}));

import { registerTools } from '../../../src/tools/s7plus/s7plus_connection.js';

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
// Schema tests: s7plus-add-connection
// ---------------------------------------------------------------------------

describe('s7plus-add-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-add-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a minimal valid input (ipAddress + plcType + managerNumber)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4 }).success).toBe(true);
  });

  it('accepts a fully specified valid input', () => {
    expect(schema.safeParse({
      ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4,
      accessPoint: 'S7ONLINE', connType: 0, password: 'secret',
      enableConnection: true, useTls: false, browseMode: 'Online'
    }).success).toBe(true);
  });

  it('accepts R/H PLC type', () => {
    expect(schema.safeParse({ ipAddress: '10.0.0.1', plcType: 2, managerNumber: 1 }).success).toBe(true);
  });

  it('accepts R/H Single PLC type', () => {
    expect(schema.safeParse({ ipAddress: '10.0.0.1', plcType: 3, managerNumber: 1 }).success).toBe(true);
  });

  it('accepts redundant connection parameters', () => {
    expect(schema.safeParse({
      ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4,
      connType: 1, reduAddress: '192.168.2.100', reduAccessPoint: 'S7ONLINE',
      reduSwitchCondition: 1
    }).success).toBe(true);
  });

  it('accepts offline browse mode with TIA export', () => {
    expect(schema.safeParse({
      ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4,
      browseMode: 'Offline', tiaExportName: 'MyProject.zip', station: 'PLC_1'
    }).success).toBe(true);
  });

  it('rejects when ipAddress is missing', () => {
    expect(schema.safeParse({ plcType: 16, managerNumber: 4 }).success).toBe(false);
  });

  it('rejects invalid IP address', () => {
    expect(schema.safeParse({ ipAddress: 'not-an-ip', plcType: 16, managerNumber: 4 }).success).toBe(false);
  });

  it('rejects when plcType is missing', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', managerNumber: 4 }).success).toBe(false);
  });

  it('rejects when managerNumber is missing', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16 }).success).toBe(false);
  });

  it('rejects managerNumber=0 (below minimum 1)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 0 }).success).toBe(false);
  });

  it('rejects managerNumber=100 (above maximum 99)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 100 }).success).toBe(false);
  });

  it('accepts managerNumber=99 (boundary max)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 99 }).success).toBe(true);
  });

  it('accepts managerNumber=1 (boundary min)', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 1 }).success).toBe(true);
  });

  it('rejects invalid browseMode', () => {
    expect(schema.safeParse({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4, browseMode: 'Invalid' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-add-connection
// ---------------------------------------------------------------------------

describe('s7plus-add-connection handler', () => {
  beforeEach(() => {
    mockAddConnection.mockResolvedValue({ success: true, connectionName: '_S7PlusConnection1' });
  });

  it('returns a success response with connectionName on success', async () => {
    const handler = capturedTools.get('s7plus-add-connection')!.handler;
    const result = await handler({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_S7PlusConnection1');
  });

  it('returns an error response when addConnection returns success=false', async () => {
    mockAddConnection.mockResolvedValue({ success: false, error: 'Driver not running' });
    const handler = capturedTools.get('s7plus-add-connection')!.handler;
    const result = await handler({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Driver not running');
  });

  it('returns an error response when addConnection throws', async () => {
    mockAddConnection.mockRejectedValue(new Error('Unexpected error'));
    const handler = capturedTools.get('s7plus-add-connection')!.handler;
    const result = await handler({ ipAddress: '192.168.1.100', plcType: 16, managerNumber: 4 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Unexpected error');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-update-connection
// ---------------------------------------------------------------------------

describe('s7plus-update-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-update-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts connectionName with one update field', () => {
    expect(schema.safeParse({ connectionName: '_S7PlusConnection1', ipAddress: '10.0.0.2' }).success).toBe(true);
  });

  it('accepts connectionName with multiple update fields', () => {
    expect(schema.safeParse({
      connectionName: '_S7PlusConnection1', ipAddress: '10.0.0.2',
      plcType: 272, enableConnection: false, useTls: true
    }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({ ipAddress: '10.0.0.2' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-update-connection
// ---------------------------------------------------------------------------

describe('s7plus-update-connection handler', () => {
  beforeEach(() => {
    mockUpdateConnection.mockResolvedValue({ success: true });
  });

  it('returns success response on successful update', async () => {
    const handler = capturedTools.get('s7plus-update-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1', ipAddress: '10.0.0.2' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_S7PlusConnection1');
  });

  it('returns error response when updateConnection returns success=false', async () => {
    mockUpdateConnection.mockResolvedValue({ success: false, error: 'Connection not found' });
    const handler = capturedTools.get('s7plus-update-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1', ipAddress: '10.0.0.2' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection not found');
  });

  it('returns error response when updateConnection throws', async () => {
    mockUpdateConnection.mockRejectedValue(new Error('Timeout'));
    const handler = capturedTools.get('s7plus-update-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1', ipAddress: '10.0.0.2' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Timeout');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-delete-connection
// ---------------------------------------------------------------------------

describe('s7plus-delete-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-delete-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a valid connectionName', () => {
    expect(schema.safeParse({ connectionName: '_S7PlusConnection1' }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-delete-connection
// ---------------------------------------------------------------------------

describe('s7plus-delete-connection handler', () => {
  beforeEach(() => {
    mockDeleteConnection.mockResolvedValue({ success: true });
  });

  it('returns success response on successful deletion', async () => {
    const handler = capturedTools.get('s7plus-delete-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_S7PlusConnection1');
  });

  it('returns error response when deleteConnection returns success=false', async () => {
    mockDeleteConnection.mockResolvedValue({ success: false, error: 'Not found' });
    const handler = capturedTools.get('s7plus-delete-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Not found');
  });

  it('returns error response when deleteConnection throws', async () => {
    mockDeleteConnection.mockRejectedValue(new Error('Connection in use'));
    const handler = capturedTools.get('s7plus-delete-connection')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection in use');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-browse
// ---------------------------------------------------------------------------

describe('s7plus-browse schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-browse')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts minimal input with just connectionName', () => {
    expect(schema.safeParse({ connectionName: '_S7PlusConnection1' }).success).toBe(true);
  });

  it('accepts full valid input', () => {
    expect(schema.safeParse({
      connectionName: '_S7PlusConnection1', mode: 'Online',
      category: 'Blocks', nodeName: 'Data_block_2', subPath: 'SubStruct|Member',
      offset: 0, limit: 100
    }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid mode', () => {
    expect(schema.safeParse({ connectionName: '_S7PlusConnection1', mode: 'Invalid' }).success).toBe(false);
  });

  it('accepts all valid modes', () => {
    for (const mode of ['Online', 'Offline', 'Root', 'AccessPoints']) {
      expect(schema.safeParse({ connectionName: '_S7PlusConnection1', mode }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-browse
// ---------------------------------------------------------------------------

describe('s7plus-browse handler', () => {
  it('returns success response with node data', async () => {
    const handler = capturedTools.get('s7plus-browse')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.nodes).toHaveLength(1);
  });

  it('returns error response when browse throws', async () => {
    mockBrowse.mockRejectedValueOnce(new Error('Connection not active'));
    const handler = capturedTools.get('s7plus-browse')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Connection not active');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-get-connection-state
// ---------------------------------------------------------------------------

describe('s7plus-get-connection-state schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-get-connection-state')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a valid connectionName', () => {
    expect(schema.safeParse({ connectionName: '_S7PlusConnection1' }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-get-connection-state
// ---------------------------------------------------------------------------

describe('s7plus-get-connection-state handler', () => {
  it('returns success response with state data', async () => {
    const handler = capturedTools.get('s7plus-get-connection-state')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
  });

  it('returns error response when getConnectionState returns success=false', async () => {
    mockGetConnectionState.mockResolvedValueOnce({ success: false, error: 'Not found' });
    const handler = capturedTools.get('s7plus-get-connection-state')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Not found');
  });

  it('returns error response when getConnectionState throws', async () => {
    mockGetConnectionState.mockRejectedValueOnce(new Error('Timeout'));
    const handler = capturedTools.get('s7plus-get-connection-state')!.handler;
    const result = await handler({ connectionName: '_S7PlusConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Timeout');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: s7plus-manage-ca-certificates
// ---------------------------------------------------------------------------

describe('s7plus-manage-ca-certificates schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('s7plus-manage-ca-certificates')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts list-ca action without certificates', () => {
    expect(schema.safeParse({ action: 'list-ca' }).success).toBe(true);
  });

  it('accepts add action with certificates', () => {
    expect(schema.safeParse({ action: 'add', certificates: ['ca.pem'] }).success).toBe(true);
  });

  it('accepts remove action with certificates', () => {
    expect(schema.safeParse({ action: 'remove', certificates: ['ca.pem'] }).success).toBe(true);
  });

  it('rejects invalid action', () => {
    expect(schema.safeParse({ action: 'invalid' }).success).toBe(false);
  });

  it('rejects when action is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: s7plus-manage-ca-certificates
// ---------------------------------------------------------------------------

describe('s7plus-manage-ca-certificates handler', () => {
  it('returns certificates on list-ca', async () => {
    const handler = capturedTools.get('s7plus-manage-ca-certificates')!.handler;
    const result = await handler({ action: 'list-ca' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.certificates).toEqual(['ca.pem']);
  });

  it('returns added certificates on add', async () => {
    const handler = capturedTools.get('s7plus-manage-ca-certificates')!.handler;
    const result = await handler({ action: 'add', certificates: ['new-ca.pem'] });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.added).toEqual(['new-ca.pem']);
  });

  it('returns error when add is called without certificates', async () => {
    const handler = capturedTools.get('s7plus-manage-ca-certificates')!.handler;
    const result = await handler({ action: 'add' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
  });

  it('returns error when remove is called without certificates', async () => {
    const handler = capturedTools.get('s7plus-manage-ca-certificates')!.handler;
    const result = await handler({ action: 'remove' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool registration count
// ---------------------------------------------------------------------------

describe('S7Plus tool registration', () => {
  it('registers all 8 tools', () => {
    for (const name of [
      's7plus-add-connection',
      's7plus-update-connection',
      's7plus-delete-connection',
      's7plus-list-connections',
      's7plus-get-connection-state',
      's7plus-browse',
      's7plus-manage-ca-certificates',
      's7plus-discover-tia-projects'
    ]) {
      expect(capturedTools.has(name)).toBe(true);
    }
  });

  it('registerTools returns 8', () => {
    const fresh = new Map<string, CapturedTool>();
    const freshServer = {
      tool(name: string, desc: string, schema: z.ZodRawShape, handler: (...args: any[]) => any) {
        fresh.set(name, { description: desc, schema: z.object(schema), handler });
      }
    };
    const count = registerTools(freshServer as any, {} as any);
    expect(count).toBe(8);
  });
});
