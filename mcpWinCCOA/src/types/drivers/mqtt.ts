/**
 * MQTT Driver Types
 *
 * Type definitions for MQTT connections.
 * Based on WinCC OA _MqttConnection internal datapoint structure.
 */

import type { ConnectionConfig } from './connection.js';

// ============================================================================
// MQTT Enums
// ============================================================================

/**
 * MQTT Connection Type
 * Defines the security/transport type for MQTT connections
 */
export enum MqttConnectionType {
  /** Unsecure TCP connection (default port 1883) */
  Unsecure = 1,
  /** TLS encrypted connection (default port 8883) */
  TLS = 2,
  /** WebSocket connection */
  WebSocket = 3,
  /** TLS with Pre-Shared Key */
  TLS_PSK = 4
}

/**
 * MQTT Protocol Version
 */
export enum MqttProtocolVersion {
  /** Default (driver decides) */
  Default = 0,
  /** MQTT v3.1 */
  V3_1 = 3,
  /** MQTT v3.1.1 */
  V3_1_1 = 4,
  /** MQTT v5.0 */
  V5_0 = 5
}

/**
 * MQTT SSL/TLS Version
 */
export enum MqttSslVersion {
  /** Default */
  Default = 0,
  /** TLS v1.0 */
  TLS_1_0 = 2,
  /** TLS v1.1 */
  TLS_1_1 = 3,
  /** TLS v1.2 */
  TLS_1_2 = 4,
  /** Any version */
  Any = 5,
  /** TLS v1.0 or later */
  TLS_1_0_OrLater = 8,
  /** TLS v1.1 or later */
  TLS_1_1_OrLater = 9,
  /** TLS v1.2 or later */
  TLS_1_2_OrLater = 10,
  /** TLS v1.3 */
  TLS_1_3 = 15,
  /** TLS v1.3 or later */
  TLS_1_3_OrLater = 16
}

/**
 * MQTT Connection State
 * Used in State.ConnState datapoint element
 */
export enum MqttConnectionState {
  /** Connection is inactive */
  Inactive = 0,
  /** Disconnected from broker */
  Disconnected = 1,
  /** Connecting to broker */
  Connecting = 2,
  /** Connected to broker */
  Connected = 3,
  /** Disconnecting from broker */
  Disconnecting = 4,
  /** Connection failure */
  Failure = 5,
  /** Listening (server mode) */
  Listening = 6
}

/**
 * MQTT Quality of Service levels
 */
export enum MqttQoS {
  /** At most once (fire and forget) */
  AtMostOnce = 0,
  /** At least once (acknowledged delivery) */
  AtLeastOnce = 1,
  /** Exactly once (assured delivery) */
  ExactlyOnce = 2
}

/**
 * MQTT Address Direction (for peripheral addresses)
 */
export enum MqttAddressDirection {
  /** Publish (output) - WinCC OA sends to broker */
  Publish = 1,
  /** Subscribe (input) - WinCC OA receives from broker */
  Subscribe = 2,
  /** Both (in/out) - bidirectional */
  Both = 6
}

/**
 * MQTT Transformation Type (for peripheral addresses)
 */
export enum MqttTransformation {
  /** Plain string (no transformation) */
  PlainString = 1001,
  /** JSON Profile: Value only */
  JsonValue = 1002,
  /** JSON Profile: Value + Timestamp */
  JsonValueTimestamp = 1003,
  /** JSON Profile: Value + Timestamp + Status */
  JsonValueTimestampStatus = 1004
}

// ============================================================================
// MQTT Connection Configuration
// ============================================================================

/**
 * MQTT Connection Configuration
 * Used to create and configure MQTT connections
 */
export interface MqttConnectionConfig extends ConnectionConfig {
  /** Connection type (Unsecure, TLS, WebSocket, TLS-PSK) */
  connectionType: MqttConnectionType;

  /** Host and port in format "host:port" (e.g., "broker.example.com:1883") */
  connectionString: string;

  /** Manager/Driver number (1-99). If not specified, uses lowest available MQTT driver. */
  managerNumber?: number;

  /** Username for authentication (optional) */
  username?: string;

  /** Password for authentication (optional) */
  password?: string;

  /** Broker certificate file name for TLS (optional) */
  certificate?: string;

  /** Client ID (optional, auto-generated if not provided) */
  clientId?: string;

  /** Client certificate for mutual TLS (optional) */
  clientCertificate?: string;

  /** Client certificate key for mutual TLS (optional) */
  clientKey?: string;

  /** Client certificate password (optional) */
  clientCertPassword?: string;

  /** PSK Identity for TLS-PSK (optional) */
  pskIdentity?: string;

  /** Pre-Shared Key for TLS-PSK (optional) */
  psk?: string;

  /** SSL/TLS version (optional, default: Default) */
  sslVersion?: MqttSslVersion;

  /** MQTT protocol version (optional, default: Default) */
  protocolVersion?: MqttProtocolVersion;

  /** Keep alive interval in seconds (default: 20) */
  keepAliveInterval?: number;

  /** Reconnect interval in seconds (default: 20) */
  reconnectInterval?: number;

  /** Use UTC timestamps (default: true) */
  useUtc?: boolean;

  /** Timezone offset in minutes (default: 0) */
  timezoneOffset?: number;

  /** Set invalid bit on connection loss (default: false) */
  setInvalidBit?: boolean;

  /** Enable statistics collection (default: true) */
  enableStatistics?: boolean;

  /** Use persistent session (default: true) */
  persistentSession?: boolean;

  /** Last Will topic (optional) */
  lastWillTopic?: string;

  /** Last Will message (optional) */
  lastWillMessage?: string;

  /** Last Will QoS (optional, default: 0) */
  lastWillQoS?: MqttQoS;

  /** Last Will retain flag (optional, default: false) */
  lastWillRetain?: boolean;

  /** Sparkplug B Host ID (optional, for Sparkplug B mode) */
  sparkplugHostId?: string;

  /** JSON Profiles for value transformation (optional, dyn_string) */
  jsonProfiles?: string[];
}

/**
 * Default values for MQTT connections
 */
export const MQTT_DEFAULTS = {
  connectionType: MqttConnectionType.Unsecure,
  keepAliveInterval: 20,
  reconnectInterval: 20,
  useUtc: true,
  timezoneOffset: 0,
  setInvalidBit: false,
  enableStatistics: true,
  persistentSession: true,
  enableConnection: true,
  protocolVersion: MqttProtocolVersion.Default,
  sslVersion: MqttSslVersion.Default,
  lastWillQoS: MqttQoS.AtMostOnce,
  lastWillRetain: false
} as const;

// ============================================================================
// MQTT Address Configuration (for peripheral addresses)
// ============================================================================

/**
 * MQTT Address Configuration
 * Used to configure peripheral addresses for MQTT topics
 */
export interface MqttAddressParams {
  /** Full datapoint element name (e.g., "MyDevice.Temperature.Value") */
  dpeName: string;

  /** MQTT topic (e.g., "home/sensors/temp") */
  topic: string;

  /** Connection name (e.g., "_MqttConnection1" or "MqttConnection1") */
  connectionName: string;

  /** Direction: Publish (1), Subscribe (2), or Both (6) */
  direction: MqttAddressDirection;

  /** Quality of Service level (optional) */
  qos?: MqttQoS;

  /** Retain flag for publishing (optional) */
  retain?: boolean;

  /** Transformation type (default: PlainString = 1000) */
  transformation?: MqttTransformation;

  /** Driver number (1-99). If not provided, auto-detected from connection. */
  driverNumber?: number;

  /** Enable old/new comparison (only for input, optional) */
  oldNewComparison?: boolean;

  /** On-use mode (subscribe only when actively used, optional) */
  onUse?: boolean;
}

// ============================================================================
// MQTT Internal Datapoint Structure (for reference)
// ============================================================================

/**
 * MQTT Config.Address JSON structure
 * This is the JSON format stored in _MqttConnection.Config.Address
 */
export interface MqttAddressJson {
  /** Connection type (1=Unsecure, 2=TLS, 3=WebSocket, 4=TLS-PSK) */
  ConnectionType: number;
  /** Connection string "host:port" */
  ConnectionString: string;
  /** Username */
  Username: string;
  /** Password (encrypted blob as string) */
  Password: string;
  /** Broker certificate */
  Certificate: string;
  /** Client ID (optional) */
  ClientId?: string;
  /** Client certificate (optional) */
  ClientCert?: string;
  /** Client key (optional) */
  ClientKey?: string;
  /** Client certificate password (optional) */
  ClientPass?: string;
  /** PSK Identity (required, can be empty) */
  Identity: string;
  /** Pre-Shared Key (required, can be empty) */
  PSK: string;
  /** SSL Version (optional) */
  SslVersion?: number;
  /** Protocol Version (optional) */
  ProtVersion?: number;
  /** Max Topic Alias (optional, MQTT 5.0) */
  MaxTopicAlias?: number;
}
