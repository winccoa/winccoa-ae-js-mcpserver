/**
 * Snapshot tests for src/types/drivers/opcua.ts
 *
 * Consolidates enum/constant pinning into snapshots. A snapshot failure means
 * a wire-protocol value changed — review carefully before updating.
 *
 * To update after intentional changes: npx vitest run --update-snapshots
 */

import { describe, it, expect } from 'vitest';
import {
  SecurityPolicy,
  MessageSecurityMode,
  OPCUA_DEFAULTS
} from '../../../src/types/drivers/opcua.js';

describe('OPC UA enum values (snapshot)', () => {
  it('SecurityPolicy values match snapshot', () => {
    expect({
      None: SecurityPolicy.None,
      Basic128Rsa15: SecurityPolicy.Basic128Rsa15,
      Basic256: SecurityPolicy.Basic256,
      Basic256Sha256: SecurityPolicy.Basic256Sha256,
      Aes128Sha256RsaOaep: SecurityPolicy.Aes128Sha256RsaOaep,
      Aes256Sha256RsaPss: SecurityPolicy.Aes256Sha256RsaPss
    }).toMatchSnapshot();
  });

  it('MessageSecurityMode values match snapshot', () => {
    expect({
      None: MessageSecurityMode.None,
      Sign: MessageSecurityMode.Sign,
      SignAndEncrypt: MessageSecurityMode.SignAndEncrypt
    }).toMatchSnapshot();
  });
});

describe('OPCUA_DEFAULTS (snapshot)', () => {
  it('all default values match snapshot', () => {
    expect({ ...OPCUA_DEFAULTS }).toMatchSnapshot();
  });
});
