/**
 * Direct tests for OpcUaConnection.addAddressConfig
 *
 * These tests instantiate OpcUaConnection and configure its internal
 * WinccoaManager mock to verify:
 *   - The $$ separator in the _address._reference string is built correctly
 *   - Error paths: missing DP, missing connection, dpSetWait failure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpcUaConnection } from '../../../src/helpers/drivers/OpcUaConnection.js';

// ---------------------------------------------------------------------------
// Helper: build a fully-configured mock winccoa instance
// ---------------------------------------------------------------------------

function buildMockWinccoa(overrides?: Partial<Record<string, any>>) {
  return {
    dpExists: vi.fn().mockReturnValue(false),
    dpCreate: vi.fn().mockResolvedValue(true),
    dpGet: vi.fn().mockResolvedValue([]),
    dpSet: vi.fn().mockReturnValue(true),
    dpSetWait: vi.fn().mockResolvedValue(undefined),
    dpConnect: vi.fn().mockReturnValue(1),
    dpDisconnect: vi.fn(),
    dpNames: vi.fn().mockReturnValue([]),
    dpTypes: vi.fn().mockReturnValue([]),
    dpDelete: vi.fn().mockResolvedValue(true),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Helpers to inspect dpSetWait calls
// ---------------------------------------------------------------------------

function findDpSetWaitCallWithField(mock: any, fieldPattern: string) {
  return mock.dpSetWait.mock.calls.find(([dpes]: any[]) =>
    Array.isArray(dpes) && dpes.some((d: string) => d.includes(fieldPattern))
  );
}

function getValueAtField(call: any[], fieldPattern: string): any {
  const dpes = call[0] as string[];
  const values = call[1] as any[];
  const idx = dpes.findIndex((d: string) => d.includes(fieldPattern));
  return idx !== -1 ? values[idx] : undefined;
}

// ---------------------------------------------------------------------------
// addAddressConfig: $$ separator in _reference
// ---------------------------------------------------------------------------

describe('OpcUaConnection.addAddressConfig — reference string', () => {
  let opcua: OpcUaConnection;
  let mock: ReturnType<typeof buildMockWinccoa>;

  beforeEach(() => {
    opcua = new OpcUaConnection();
    mock = buildMockWinccoa();
    (opcua as any).winccoa = mock;

    // dpExists: dp base 'MyDP', connection '_OpcUAConnection1', manager '_OPCUA4', subscription '_DefaultPollingFast'
    mock.dpExists.mockImplementation((name: string) =>
      ['MyDP', '_OpcUAConnection1', '_OPCUA4', '_DefaultPollingFast'].includes(name)
    );

    // dpGet: return server list that includes the connection (for validateManagerNumberForConnection)
    mock.dpGet.mockResolvedValue(['OpcUAConnection1']);
  });

  it('builds _reference with double $$ separator', async () => {
    await opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=MyVar', 750, 4, true, 4);

    const call = findDpSetWaitCallWithField(mock, '_reference');
    expect(call).toBeDefined();
    const reference = getValueAtField(call!, '_reference');
    expect(reference).toBe('OpcUAConnection1$$1$1$ns=2;s=MyVar');
  });

  it('strips the leading underscore from the connection name in the reference', async () => {
    await opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=MyVar', 750, 4, true, 4);

    const call = findDpSetWaitCallWithField(mock, '_reference');
    const reference = getValueAtField(call!, '_reference');
    // Must NOT start with underscore
    expect(reference).not.toMatch(/^_/);
  });

  it('preserves the node ID verbatim after the separator', async () => {
    const nodeId = 'ns=3;s=Complex/Path.With.Dots';
    await opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', nodeId, 750, 4, true, 4);

    const call = findDpSetWaitCallWithField(mock, '_reference');
    const reference = getValueAtField(call!, '_reference');
    expect(reference).toBe(`OpcUAConnection1$$1$1$${nodeId}`);
  });

  it('sets _drv_ident to OPCUA', async () => {
    await opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=MyVar', 750, 4, true, 4);

    const call = findDpSetWaitCallWithField(mock, '_drv_ident');
    const drvIdent = getValueAtField(call!, '_drv_ident');
    expect(drvIdent).toBe('OPCUA');
  });

  it('sets the manager number in _distrib._driver', async () => {
    await opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=MyVar', 750, 4, true, 4);

    const call = findDpSetWaitCallWithField(mock, '_distrib.._driver');
    const driverNum = getValueAtField(call!, '_distrib.._driver');
    expect(driverNum).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// addAddressConfig: error paths
// ---------------------------------------------------------------------------

describe('OpcUaConnection.addAddressConfig — error paths', () => {
  let opcua: OpcUaConnection;
  let mock: ReturnType<typeof buildMockWinccoa>;

  beforeEach(() => {
    opcua = new OpcUaConnection();
    mock = buildMockWinccoa();
    (opcua as any).winccoa = mock;
  });

  it('throws when the datapoint base name does not exist', async () => {
    // dpExists returns false for everything (default)
    await expect(
      opcua.addAddressConfig('NonExistent.Value', '_OpcUAConnection1', 'ns=2;s=Test', 750, 4, true, 4)
    ).rejects.toThrow('does not exist');
  });

  it('throws when the connection datapoint does not exist', async () => {
    // 'MyDP' exists but '_OpcUAConnection1' does not
    mock.dpExists.mockImplementation((name: string) => name === 'MyDP');

    await expect(
      opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=Test', 750, 4, true, 4)
    ).rejects.toThrow('does not exist');
  });

  it('throws when datatype is out of range (< 750)', async () => {
    mock.dpExists.mockImplementation((name: string) =>
      ['MyDP', '_OpcUAConnection1'].includes(name)
    );

    await expect(
      opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=Test', 749, 4, true, 4)
    ).rejects.toThrow(/datatype/i);
  });

  it('throws when datatype is out of range (> 768)', async () => {
    mock.dpExists.mockImplementation((name: string) =>
      ['MyDP', '_OpcUAConnection1'].includes(name)
    );

    await expect(
      opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=Test', 769, 4, true, 4)
    ).rejects.toThrow(/datatype/i);
  });

  it('throws when dpSetWait fails during atomic config write', async () => {
    mock.dpExists.mockImplementation((name: string) =>
      ['MyDP', '_OpcUAConnection1', '_OPCUA4', '_DefaultPollingFast'].includes(name)
    );
    mock.dpGet.mockResolvedValue(['OpcUAConnection1']);
    mock.dpSetWait.mockRejectedValue(new Error('Write failed'));

    await expect(
      opcua.addAddressConfig('MyDP.Value', '_OpcUAConnection1', 'ns=2;s=Test', 750, 4, true, 4)
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// generateConnectionName: increments when name is taken
// ---------------------------------------------------------------------------

describe('OpcUaConnection — connection name generation', () => {
  it('returns _OpcUAConnection1 when no existing connections', async () => {
    const opcua = new OpcUaConnection();
    const mock = buildMockWinccoa();
    (opcua as any).winccoa = mock;

    // dpExists returns false → first available name is used
    mock.dpExists.mockReturnValue(false);

    const name = await (opcua as any).generateConnectionName('_OpcUAConnection');
    expect(name).toBe('_OpcUAConnection1');
  });

  it('returns _OpcUAConnection2 when _OpcUAConnection1 already exists', async () => {
    const opcua = new OpcUaConnection();
    const mock = buildMockWinccoa();
    (opcua as any).winccoa = mock;

    // First call (_OpcUAConnection1) returns true, second (_OpcUAConnection2) returns false
    mock.dpExists
      .mockReturnValueOnce(true)  // _OpcUAConnection1 exists
      .mockReturnValue(false);    // _OpcUAConnection2 is free

    const name = await (opcua as any).generateConnectionName('_OpcUAConnection');
    expect(name).toBe('_OpcUAConnection2');
  });
});
