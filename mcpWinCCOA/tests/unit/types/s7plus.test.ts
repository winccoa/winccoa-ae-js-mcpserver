/**
 * Snapshot tests for src/types/drivers/s7plus.ts
 *
 * Consolidates enum/constant pinning into snapshots. A snapshot failure means
 * a wire-protocol value changed — review carefully before updating.
 *
 * To update after intentional changes: npx vitest run --update-snapshots
 */

import { describe, it, expect } from 'vitest';
import {
  S7PlusPlcType,
  S7PlusConnType,
  S7PlusConnectionState,
  S7PlusEstablishmentMode,
  S7PlusTimeSyncMode,
  S7PlusSwitchCondition,
  S7PlusAddressDirection,
  S7PlusTransformation,
  S7PLUS_DEFAULTS
} from '../../../src/types/drivers/s7plus.js';

describe('S7Plus enum values (snapshot)', () => {
  it('S7PlusPlcType values match snapshot', () => {
    expect({
      Automatic: S7PlusPlcType.Automatic,
      RH: S7PlusPlcType.RH,
      RH_Single: S7PlusPlcType.RH_Single,
      S7_1500: S7PlusPlcType.S7_1500,
      S7_1200: S7PlusPlcType.S7_1200,
      S7_1500_SoftCtrl: S7PlusPlcType.S7_1500_SoftCtrl,
      PLCSim: S7PlusPlcType.PLCSim
    }).toMatchSnapshot();
  });

  it('S7PlusConnType values match snapshot', () => {
    expect({
      Single: S7PlusConnType.Single,
      ReduLan: S7PlusConnType.ReduLan
    }).toMatchSnapshot();
  });

  it('S7PlusConnectionState values match snapshot', () => {
    expect({
      Inactive: S7PlusConnectionState.Inactive,
      Disconnected: S7PlusConnectionState.Disconnected,
      Connecting: S7PlusConnectionState.Connecting,
      Connected: S7PlusConnectionState.Connected,
      Disconnecting: S7PlusConnectionState.Disconnecting,
      Failure: S7PlusConnectionState.Failure
    }).toMatchSnapshot();
  });

  it('S7PlusEstablishmentMode values match snapshot', () => {
    expect({
      Inactive: S7PlusEstablishmentMode.Inactive,
      AutomaticActive: S7PlusEstablishmentMode.AutomaticActive
    }).toMatchSnapshot();
  });

  it('S7PlusTimeSyncMode values match snapshot', () => {
    expect({
      Inactive: S7PlusTimeSyncMode.Inactive,
      SyncPLCtoOA: S7PlusTimeSyncMode.SyncPLCtoOA
    }).toMatchSnapshot();
  });

  it('S7PlusSwitchCondition values match snapshot', () => {
    expect({
      Disabled: S7PlusSwitchCondition.Disabled,
      OpState: S7PlusSwitchCondition.OpState,
      ConnState: S7PlusSwitchCondition.ConnState,
      Both: S7PlusSwitchCondition.Both,
      SwitchTag: S7PlusSwitchCondition.SwitchTag
    }).toMatchSnapshot();
  });

  it('S7PlusAddressDirection values match snapshot', () => {
    expect({
      Output: S7PlusAddressDirection.Output,
      InputSpont: S7PlusAddressDirection.InputSpont,
      InputSQuery: S7PlusAddressDirection.InputSQuery,
      InputPoll: S7PlusAddressDirection.InputPoll,
      OutputSingle: S7PlusAddressDirection.OutputSingle,
      IOSpont: S7PlusAddressDirection.IOSpont,
      IOPoll: S7PlusAddressDirection.IOPoll,
      IOSQuery: S7PlusAddressDirection.IOSQuery
    }).toMatchSnapshot();
  });

  it('S7PlusTransformation values match snapshot', () => {
    expect({
      DEFAULT: S7PlusTransformation.DEFAULT,
      BOOL: S7PlusTransformation.BOOL,
      BYTE: S7PlusTransformation.BYTE,
      WORD: S7PlusTransformation.WORD,
      DWORD: S7PlusTransformation.DWORD,
      LWORD: S7PlusTransformation.LWORD,
      USINT: S7PlusTransformation.USINT,
      UINT: S7PlusTransformation.UINT,
      UDINT: S7PlusTransformation.UDINT,
      ULINT: S7PlusTransformation.ULINT,
      SINT: S7PlusTransformation.SINT,
      INT: S7PlusTransformation.INT,
      DINT: S7PlusTransformation.DINT,
      LINT: S7PlusTransformation.LINT,
      REAL: S7PlusTransformation.REAL,
      LREAL: S7PlusTransformation.LREAL,
      DATE: S7PlusTransformation.DATE,
      DATETIME: S7PlusTransformation.DATETIME,
      TIME: S7PlusTransformation.TIME,
      TIME_OF_DAY: S7PlusTransformation.TIME_OF_DAY,
      LDATETIME: S7PlusTransformation.LDATETIME,
      LTIME: S7PlusTransformation.LTIME,
      LTOD: S7PlusTransformation.LTOD,
      DTL: S7PlusTransformation.DTL,
      S5TIME: S7PlusTransformation.S5TIME,
      STRING: S7PlusTransformation.STRING,
      WSTRING: S7PlusTransformation.WSTRING
    }).toMatchSnapshot();
  });
});

describe('S7PLUS_DEFAULTS (snapshot)', () => {
  it('all default values match snapshot', () => {
    expect({ ...S7PLUS_DEFAULTS }).toMatchSnapshot();
  });
});
