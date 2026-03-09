/**
 * Unit tests for src/tools/mqtt/mqtt_connection.ts
 *
 * Tests:
 *  - Zod schema validation for all MQTT tools
 *  - Handler behavior: correct response structure on success and error
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock MqttConnection so tool handlers never touch WinCC OA or Pmon
// ---------------------------------------------------------------------------

const mockAddConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true, connectionName: '_MqttConnection1' })
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
const mockAddAddressConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
);

vi.mock('../../../src/helpers/drivers/MqttConnection.js', () => ({
  MqttConnection: vi.fn().mockImplementation(() => ({
    addConnection: mockAddConnection,
    deleteConnection: mockDeleteConnection,
    listConnections: mockListConnections,
    getConnectionState: mockGetConnectionState,
    addAddressConfig: mockAddAddressConfig
  })),
  MqttConnectionType: { Unsecure: 1, TLS: 2, WebSocket: 3, TLS_PSK: 4 },
  MQTT_DEFAULTS: {
    connectionType: 1,
    keepAliveInterval: 20,
    reconnectInterval: 20,
    useUtc: true,
    timezoneOffset: 0,
    setInvalidBit: false,
    enableStatistics: true,
    persistentSession: true,
    enableConnection: true,
    protocolVersion: 0,
    sslVersion: 0,
    lastWillQoS: 0,
    lastWillRetain: false
  }
}));

import { registerTools } from '../../../src/tools/mqtt/mqtt_connection.js';

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
// Schema tests: mqtt-add-connection
// ---------------------------------------------------------------------------

describe('mqtt-add-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('mqtt-add-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a minimal valid input (host + port)', () => {
    expect(schema.safeParse({ host: 'broker.example.com', port: 1883 }).success).toBe(true);
  });

  it('accepts a fully specified unsecure connection', () => {
    expect(schema.safeParse({
      host: '192.168.1.10', port: 1883, connectionType: 1,
      username: 'user', password: 'pass', keepAliveInterval: 30,
      reconnectInterval: 10, persistentSession: true, enableConnection: true, clientId: 'my-client'
    }).success).toBe(true);
  });

  it('accepts a TLS connection with certificate', () => {
    expect(schema.safeParse({
      host: 'secure.broker.com', port: 8883, connectionType: 2, certificate: 'ca.pem'
    }).success).toBe(true);
  });

  it('accepts a TLS-PSK connection', () => {
    expect(schema.safeParse({
      host: 'broker.com', port: 8884, connectionType: 4, pskIdentity: 'my-id', psk: 'my-psk'
    }).success).toBe(true);
  });

  it('rejects when host is missing', () => {
    expect(schema.safeParse({ port: 1883 }).success).toBe(false);
  });

  it('rejects port=0 (below minimum 1)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 0 }).success).toBe(false);
  });

  it('rejects port=65536 (above maximum 65535)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 65536 }).success).toBe(false);
  });

  it('accepts port=65535 (boundary max)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 65535 }).success).toBe(true);
  });

  it('rejects connectionType=0 (below minimum 1)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 1883, connectionType: 0 }).success).toBe(false);
  });

  it('rejects connectionType=5 (above maximum 4)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 1883, connectionType: 5 }).success).toBe(false);
  });

  it('rejects managerNumber=0 (below minimum 1)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 1883, managerNumber: 0 }).success).toBe(false);
  });

  it('rejects managerNumber=100 (above maximum 99)', () => {
    expect(schema.safeParse({ host: 'broker.com', port: 1883, managerNumber: 100 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: mqtt-add-connection
// ---------------------------------------------------------------------------

describe('mqtt-add-connection handler', () => {
  it('returns a success response with connectionName on success', async () => {
    mockAddConnection.mockResolvedValueOnce({ success: true, connectionName: '_MqttConnection1' });
    const handler = capturedTools.get('mqtt-add-connection')!.handler;
    const result = await handler({ host: 'broker.example.com', port: 1883 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_MqttConnection1');
    expect(parsed.data.broker).toBe('broker.example.com:1883');
  });

  it('calls addConnection with the correct connectionString', async () => {
    mockAddConnection.mockResolvedValueOnce({ success: true, connectionName: '_MqttConnection1' });
    const handler = capturedTools.get('mqtt-add-connection')!.handler;
    await handler({ host: '10.0.0.1', port: 8883, connectionType: 2, managerNumber: 3 });

    expect(mockAddConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: '10.0.0.1:8883',
        connectionType: 2,
        managerNumber: 3
      })
    );
  });

  it('returns an error response when addConnection returns success=false', async () => {
    mockAddConnection.mockResolvedValueOnce({ success: false, error: 'Driver number 1 is used by simulation driver.' });
    const handler = capturedTools.get('mqtt-add-connection')!.handler;
    const result = await handler({ host: 'broker.com', port: 1883 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Driver number 1 is used by simulation driver.');
  });

  it('returns an error response when addConnection throws', async () => {
    mockAddConnection.mockRejectedValueOnce(new Error('Unexpected error'));
    const handler = capturedTools.get('mqtt-add-connection')!.handler;
    const result = await handler({ host: 'broker.com', port: 1883 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Unexpected error');
  });
});

// ---------------------------------------------------------------------------
// Schema tests: mqtt-delete-connection
// ---------------------------------------------------------------------------

describe('mqtt-delete-connection schema', () => {
  let schema: z.ZodObject<z.ZodRawShape>;

  beforeAll(() => {
    schema = capturedTools.get('mqtt-delete-connection')!.schema;
    expect(schema).toBeDefined();
  });

  it('accepts a valid connectionName', () => {
    expect(schema.safeParse({ connectionName: '_MqttConnection1' }).success).toBe(true);
  });

  it('rejects when connectionName is missing', () => {
    expect(schema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler behavior tests: mqtt-delete-connection
// ---------------------------------------------------------------------------

describe('mqtt-delete-connection handler', () => {
  it('returns success response on successful deletion', async () => {
    mockDeleteConnection.mockResolvedValueOnce({ success: true });
    const handler = capturedTools.get('mqtt-delete-connection')!.handler;
    const result = await handler({ connectionName: '_MqttConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.connectionName).toBe('_MqttConnection1');
  });

  it('returns error response when deleteConnection returns success=false', async () => {
    mockDeleteConnection.mockResolvedValueOnce({ success: false, error: 'Not found' });
    const handler = capturedTools.get('mqtt-delete-connection')!.handler;
    const result = await handler({ connectionName: '_MqttConnection1' });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Not found');
  });
});

// ---------------------------------------------------------------------------
// Tool registration count
// ---------------------------------------------------------------------------

describe('MQTT tool registration', () => {
  it('registers all 5 tools', () => {
    for (const name of [
      'mqtt-add-connection',
      'mqtt-delete-connection',
      'mqtt-list-connections',
      'mqtt-get-connection-state',
      'mqtt-add-address'
    ]) {
      expect(capturedTools.has(name)).toBe(true);
    }
  });
});
