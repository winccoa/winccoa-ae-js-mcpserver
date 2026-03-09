/**
 * Snapshot tests for src/types/drivers/mqtt.ts
 *
 * Consolidates enum/constant pinning into snapshots. A snapshot failure means
 * a wire-protocol value changed — review carefully before updating.
 *
 * To update after intentional changes: npx vitest run --update-snapshots
 */

import { describe, it, expect } from 'vitest';
import {
  MqttConnectionType,
  MqttProtocolVersion,
  MqttSslVersion,
  MqttConnectionState,
  MqttQoS,
  MqttAddressDirection,
  MqttTransformation,
  MQTT_DEFAULTS
} from '../../../src/types/drivers/mqtt.js';

describe('MQTT enum values (snapshot)', () => {
  it('MqttConnectionType values match snapshot', () => {
    expect({
      Unsecure: MqttConnectionType.Unsecure,
      TLS: MqttConnectionType.TLS,
      WebSocket: MqttConnectionType.WebSocket,
      TLS_PSK: MqttConnectionType.TLS_PSK
    }).toMatchSnapshot();
  });

  it('MqttProtocolVersion values match snapshot', () => {
    expect({
      Default: MqttProtocolVersion.Default,
      V3_1: MqttProtocolVersion.V3_1,
      V3_1_1: MqttProtocolVersion.V3_1_1,
      V5_0: MqttProtocolVersion.V5_0
    }).toMatchSnapshot();
  });

  it('MqttSslVersion values match snapshot', () => {
    expect({
      Default: MqttSslVersion.Default,
      TLS_1_0: MqttSslVersion.TLS_1_0,
      TLS_1_1: MqttSslVersion.TLS_1_1,
      TLS_1_2: MqttSslVersion.TLS_1_2,
      Any: MqttSslVersion.Any,
      TLS_1_0_OrLater: MqttSslVersion.TLS_1_0_OrLater,
      TLS_1_1_OrLater: MqttSslVersion.TLS_1_1_OrLater,
      TLS_1_2_OrLater: MqttSslVersion.TLS_1_2_OrLater,
      TLS_1_3: MqttSslVersion.TLS_1_3,
      TLS_1_3_OrLater: MqttSslVersion.TLS_1_3_OrLater
    }).toMatchSnapshot();
  });

  it('MqttConnectionState values match snapshot', () => {
    expect({
      Inactive: MqttConnectionState.Inactive,
      Disconnected: MqttConnectionState.Disconnected,
      Connecting: MqttConnectionState.Connecting,
      Connected: MqttConnectionState.Connected,
      Disconnecting: MqttConnectionState.Disconnecting,
      Failure: MqttConnectionState.Failure,
      Listening: MqttConnectionState.Listening
    }).toMatchSnapshot();
  });

  it('MqttQoS values match snapshot', () => {
    expect({
      AtMostOnce: MqttQoS.AtMostOnce,
      AtLeastOnce: MqttQoS.AtLeastOnce,
      ExactlyOnce: MqttQoS.ExactlyOnce
    }).toMatchSnapshot();
  });

  it('MqttAddressDirection values match snapshot', () => {
    expect({
      Publish: MqttAddressDirection.Publish,
      Subscribe: MqttAddressDirection.Subscribe,
      Both: MqttAddressDirection.Both
    }).toMatchSnapshot();
  });

  it('MqttTransformation values match snapshot', () => {
    expect({
      PlainString: MqttTransformation.PlainString,
      JsonValue: MqttTransformation.JsonValue,
      JsonValueTimestamp: MqttTransformation.JsonValueTimestamp,
      JsonValueTimestampStatus: MqttTransformation.JsonValueTimestampStatus
    }).toMatchSnapshot();
  });
});

describe('MQTT_DEFAULTS (snapshot)', () => {
  it('all default values match snapshot', () => {
    expect({ ...MQTT_DEFAULTS }).toMatchSnapshot();
  });
});
