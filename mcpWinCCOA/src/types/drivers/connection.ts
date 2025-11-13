/**
 * Driver Connection Configuration Types
 *
 * Base types and specific configurations for different driver types.
 */

/**
 * Base connection configuration
 * All driver-specific configs should extend this interface
 */
export interface ConnectionConfig {
  /** Enable connection immediately after creation */
  enableConnection?: boolean;
}

/**
 * OPC UA Security Policy
 */
export enum SecurityPolicy {
  None = 0,
  Basic128Rsa15 = 2,
  Basic256 = 3,
  Basic256Sha256 = 4,
  Aes128Sha256RsaOaep = 5,
  Aes256Sha256RsaPss = 6
}

/**
 * OPC UA Message Security Mode
 */
export enum MessageSecurityMode {
  None = 0,
  Sign = 1,
  SignAndEncrypt = 2
}

/**
 * OPC UA Connection Configuration
 */
export interface OpcUaConnectionConfig extends ConnectionConfig {
  /** IP address of the OPC UA server */
  ipAddress: string;

  /** Port of the OPC UA server */
  port: number;

  /** Manager number of the OPC UA client (e.g., 4 for _OPCUA4) */
  managerNumber: number;

  /** Reconnect timer in seconds (default: 10) */
  reconnectTimer?: number;

  /** Security policy (default: None) */
  securityPolicy?: SecurityPolicy;

  /** Message security mode (default: None) */
  messageSecurityMode?: MessageSecurityMode;

  /** Username for authentication */
  username?: string;

  /** Password for authentication */
  password?: string;

  /** Client certificate name */
  clientCertificate?: string;

  /** Separator for display names (default: ".") */
  separator?: string;
}

/**
 * Default values for OPC UA connections
 */
export const OPCUA_DEFAULTS = {
  reconnectTimer: 10,
  securityPolicy: SecurityPolicy.None,
  messageSecurityMode: MessageSecurityMode.None,
  separator: '.',
  enableConnection: true
} as const;
