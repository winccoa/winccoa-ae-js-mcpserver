/**
 * S7Plus Driver Types
 *
 * Type definitions for S7Plus connections (Siemens S7-1200/1500 PLCs).
 * Based on WinCC OA _S7PlusConnection internal datapoint structure.
 *
 * The S7Plus driver uses modern symbolic addressing exclusively and supports
 * S7-1200, S7-1500, S7-1500 Software Controller, and PLCSim devices.
 * It does NOT support legacy S7-300/400 devices.
 */

import type { ConnectionConfig } from './connection.js';

// ============================================================================
// S7Plus Enums
// ============================================================================

/**
 * S7Plus PLC Type
 * Defines the type of PLC connected via S7Plus
 */
export enum S7PlusPlcType {
  /** Automatic PLC type detection (determined from TIA project) */
  Automatic = 1,
  /** R/H - Redundant High Availability (two redundant PLCs) */
  RH = 2,
  /** R/H Single - Single PLC in R/H system */
  RH_Single = 3,
  /** S7-1500 PLC */
  S7_1500 = 16,
  /** S7-1200 PLC */
  S7_1200 = 272,
  /** S7-1500 Software Controller (Soft PLC) */
  S7_1500_SoftCtrl = 528,
  /** PLCSim (simulation) */
  PLCSim = 768
}

/**
 * S7Plus Connection Type
 * Defines the connection redundancy mode
 */
export enum S7PlusConnType {
  /** Single connection to PLC */
  Single = 0,
  /** Redundant LAN (two connections via separate networks) */
  ReduLan = 1
}

/**
 * S7Plus Connection State
 * Used in State.ConnState datapoint element
 */
export enum S7PlusConnectionState {
  /** Connection is inactive */
  Inactive = 0,
  /** Disconnected from PLC */
  Disconnected = 1,
  /** Connecting to PLC */
  Connecting = 2,
  /** Connected to PLC */
  Connected = 3,
  /** Disconnecting from PLC */
  Disconnecting = 4,
  /** Connection failure */
  Failure = 5
}

/**
 * S7Plus Establishment Mode
 * Controls how the connection is established
 */
export enum S7PlusEstablishmentMode {
  /** Connection is inactive */
  Inactive = 0,
  /** Connection is automatically activated */
  AutomaticActive = 1
}

/**
 * S7Plus Time Sync Mode
 * Controls time synchronization between WinCC OA and PLC
 */
export enum S7PlusTimeSyncMode {
  /** No time synchronization */
  Inactive = 0,
  /** Synchronize PLC time to WinCC OA time */
  SyncPLCtoOA = 1
}

/**
 * S7Plus Redundancy Switch Condition
 * Defines when to switch to redundant connection
 */
export enum S7PlusSwitchCondition {
  /** Redundancy switching disabled */
  Disabled = 0,
  /** Switch based on PLC operating state */
  OpState = 1,
  /** Switch based on connection state */
  ConnState = 2,
  /** Switch based on both OpState AND ConnState */
  Both = 3,
  /** Switch based on a boolean PLC variable */
  SwitchTag = 4
}

/**
 * S7Plus PLC Operating State
 * Values from State.Connections.OpState
 */
export enum S7PlusOpState {
  /** PLC is in Stop mode */
  Stop = 4,
  /** PLC is starting up */
  Startup = 6,
  /** PLC is running */
  Run = 8,
  /** PLC is running in redundant mode */
  RunRedundant = 9,
  /** PLC is running with ODIS (Online Diagnostic) */
  RunODIS = 18
}

/**
 * S7Plus Login State
 * Values from State.Connections.State
 */
export enum S7PlusLoginState {
  /** Logged out from PLC */
  LoggedOut = 0,
  /** Logging in to PLC */
  LoggingIn = 1,
  /** Logged in to PLC */
  LoggedIn = 2,
  /** Logging out from PLC */
  LoggingOut = 3
}

/**
 * S7Plus Legitimation Level
 * Access control level for the PLC connection
 */
export enum S7PlusLegitimationLevel {
  /** Invalid/failed authentication */
  Invalid = -1,
  /** Failsafe access (minimal) */
  Failsafe = 0,
  /** Full access */
  Full = 1,
  /** Read/Write access */
  ReadWrite = 2,
  /** Read-only access */
  ReadOnly = 3,
  /** Inactive (no access) */
  InactiveAccess = 4
}

/**
 * S7Plus Address Direction (for peripheral addresses)
 * Maps to DpAddressDirection values used in _address.._direction
 */
export enum S7PlusAddressDirection {
  /** Output - WinCC OA sends to PLC */
  Output = 1,
  /** Input spontaneous - does NOT work with S7Plus, use IOPoll (7) + subscription instead */
  InputSpont = 2,
  /** Input single query - one-time read from PLC */
  InputSQuery = 3,
  /** Input polling - cyclic read from PLC */
  InputPoll = 4,
  /** Output single - single write to PLC */
  OutputSingle = 5,
  /** I/O spontaneous - does NOT work with S7Plus, use IOPoll (7) + subscription instead */
  IOSpont = 6,
  /** I/O polling - bidirectional with cyclic input */
  IOPoll = 7,
  /** I/O single query - bidirectional with one-time input */
  IOSQuery = 8
}

/**
 * S7Plus Transformation Type (for peripheral addresses)
 * Range: 1001-1027 - S7Plus data type mapping
 */
export enum S7PlusTransformation {
  /** Default (auto-detect) */
  DEFAULT = 1001,
  /** Boolean */
  BOOL = 1002,
  /** 8-bit unsigned integer */
  BYTE = 1003,
  /** 16-bit bitfield */
  WORD = 1004,
  /** 32-bit bitfield */
  DWORD = 1005,
  /** 64-bit bitfield */
  LWORD = 1006,
  /** 8-bit unsigned integer */
  USINT = 1007,
  /** 16-bit unsigned integer */
  UINT = 1008,
  /** 32-bit unsigned integer */
  UDINT = 1009,
  /** 64-bit unsigned integer */
  ULINT = 1010,
  /** 8-bit signed integer */
  SINT = 1011,
  /** 16-bit signed integer */
  INT = 1012,
  /** 32-bit signed integer */
  DINT = 1013,
  /** 64-bit signed integer */
  LINT = 1014,
  /** 32-bit floating point */
  REAL = 1015,
  /** 64-bit floating point */
  LREAL = 1016,
  /** Date (days since 1970-01-01) */
  DATE = 1017,
  /** Date and time */
  DATETIME = 1018,
  /** Time in milliseconds (32-bit) */
  TIME = 1019,
  /** Time of day in milliseconds since midnight */
  TIME_OF_DAY = 1020,
  /** Long date and time */
  LDATETIME = 1021,
  /** Long time in nanoseconds (64-bit) */
  LTIME = 1022,
  /** Long time of day in milliseconds (64-bit) */
  LTOD = 1023,
  /** Date and time long (12-byte struct) */
  DTL = 1024,
  /** S5 time in milliseconds (16-bit) */
  S5TIME = 1025,
  /** String */
  STRING = 1026,
  /** Wide string */
  WSTRING = 1027
}

// ============================================================================
// S7Plus Connection Configuration
// ============================================================================

/**
 * S7Plus Connection Configuration
 * Used to create and configure S7Plus connections
 */
export interface S7PlusConnectionConfig extends ConnectionConfig {
  /** PLC IP address (IPv4, e.g., "192.168.1.100") */
  ipAddress: string;

  /** PLC type (S7-1200, S7-1500, S7-1500 SoftCtrl, PLCSim) */
  plcType: S7PlusPlcType;

  /** Manager/Driver number (1-99). If not specified, uses lowest available S7Plus driver. */
  managerNumber?: number;

  /** Access point (default: "S7ONLINE") */
  accessPoint?: string;

  /** Connection type: Single or ReduLan (default: Single) */
  connType?: S7PlusConnType;

  /** Keep alive timeout in seconds (default: 20) */
  keepAliveTimeout?: number;

  /** Reconnect timeout in seconds (default: 20) */
  reconnectTimeout?: number;

  /** Use UTC timestamps (default: true) */
  useUtc?: boolean;

  /** Timezone offset in minutes (default: 0) */
  timezoneOffset?: number;

  /** Set invalid bit on connection loss (default: false) */
  setInvalidBit?: boolean;

  /** Enable statistics collection (default: true) */
  enableStatistics?: boolean;

  /** Enable diagnostics (default: false) */
  enableDiagnostics?: boolean;

  /** Read PLC operating state (default: false) */
  readOpState?: boolean;

  /** Acquire values on connect via general query (default: true) */
  acquireValuesOnConnect?: boolean;

  /** Time synchronization mode (default: Inactive) */
  timeSyncMode?: S7PlusTimeSyncMode;

  /** Time sync interval in seconds (default: 86400 = 24 hours) */
  timeSyncInterval?: number;

  /** Encrypted password for protected PLCs (WinCC OA encrypted blob, optional) */
  password?: string;

  /** Station name in format "Project|Station" (optional, for TIA project reference) */
  stationName?: string;

  /** String encoding codepage MIB value (optional) */
  codepage?: number;

  /** Use TLS encryption for connection (default: false). Sets LegitimationLevel. */
  useTls?: boolean;

  /** Server certificate file name for TLS verification (optional, stored in Config.Certificate) */
  certificate?: string;

  // --- Redundancy settings ---

  /** Redundant connection IP address (required for ReduLan) */
  reduAddress?: string;

  /** Redundant connection access point (optional, defaults to accessPoint) */
  reduAccessPoint?: string;

  /** Redundancy switch condition (default: Disabled) */
  reduSwitchCondition?: S7PlusSwitchCondition;

  /** Boolean PLC variable for switch condition (required when switchCondition = SwitchTag) */
  reduSwitchTag?: string;
}

/**
 * Default values for S7Plus connections
 */
export const S7PLUS_DEFAULTS = {
  accessPoint: 'S7ONLINE',
  connType: S7PlusConnType.Single,
  keepAliveTimeout: 20,
  reconnectTimeout: 20,
  useUtc: true,
  timezoneOffset: 0,
  setInvalidBit: false,
  enableStatistics: true,
  enableDiagnostics: false,
  readOpState: false,
  acquireValuesOnConnect: true,
  timeSyncMode: S7PlusTimeSyncMode.Inactive,
  timeSyncInterval: 86400,
  enableConnection: true,
  useTls: false,
  reduSwitchCondition: S7PlusSwitchCondition.Disabled
} as const;

// ============================================================================
// S7Plus Address Configuration (for peripheral addresses)
// ============================================================================

/**
 * S7Plus Address Configuration
 * Used to configure peripheral addresses for S7Plus symbolic PLC variables
 */
export interface S7PlusAddressParams {
  /** Full datapoint element name (e.g., "MyDevice.Temperature.Value") */
  dpeName: string;

  /**
   * Symbolic PLC address reference.
   * Format for data: <Symbolic Address in PLC>[:length]
   * Examples: MyDB.MyVar, MyDB.MyArray[3], MyDB.MyString:50
   * Format for alarms: <Symbolic Address>:[associated value]:[additional text]
   */
  reference: string;

  /**
   * Direction: Output (1), InputSQuery (3), InputPoll (4),
   * OutputSingle (5), IOPoll (7), IOSQuery (8).
   * For S7Plus, use IOPoll (7) for both polling AND subscription.
   * The difference is determined by the poll group and _S7PlusConfig registration.
   * NOTE: IOSpont (6) and InputSpont (2) do NOT work with S7Plus.
   */
  direction: S7PlusAddressDirection;

  /** Transformation type (default: DEFAULT = 1001) */
  transformation?: S7PlusTransformation;

  /** Driver number (1-99). Required - determines which S7Plus driver handles this address. */
  driverNumber: number;

  /** S7Plus connection datapoint name. Required for _address.._connection. */
  connectionName: string;

  /** Enable old/new comparison for input (optional, default: true) */
  oldNewComparison?: boolean;

  /** Item length for string types (optional) */
  itemLength?: number;

  /**
   * Poll group name for polling and subscription modes.
   * Required for directions: InputPoll (4), IOPoll (7).
   * Both polling and subscription modes use a _PollGroup datapoint internally.
   * If not specified, a default poll group is created automatically:
   *   - Polling: "_S7Plus_Poll_1s" (1000ms interval)
   *   - Subscription: "_S7Plus_Subscr" (1000ms interval)
   * Subscription mode is activated by setting onlyChanges (not by direction value).
   * The poll group DP (type _PollGroup) is created if it does not exist yet.
   */
  pollGroup?: string;

  /**
   * Poll interval in milliseconds for the poll group (default: 1000).
   * Only used when the poll group is newly created.
   * For polling: determines the cyclic read interval.
   * For subscription: used internally by the driver.
   */
  pollInterval?: number;

  /**
   * Only report value changes for subscription mode (default: true).
   * Subscription mode is activated by setting this parameter (true or false).
   * For S7Plus, always use direction IOPoll (7) with subscription — NOT IOSpont (6).
   * Stored in _S7PlusConfig.Subscriptions.Options: 1 = only changes, 0 = all updates.
   */
  onlyChanges?: boolean;
}

// ============================================================================
// S7Plus Browse Types (for TIA project / online device browsing)
// ============================================================================

/**
 * S7Plus Browse Node
 * Represents a single node in the S7Plus TIA project structure.
 *
 * Browse results come from the _S7PlusConnection.Browse.* DPEs:
 * - Browse.NodePaths (dyn_string) → path
 * - Browse.NodeComments (dyn_string) → comment
 * - Browse.SystemTypes (dyn_string) → systemType ("Station","Block","Tag","Variable","Array","ComplexTag","Type")
 * - Browse.ValueTypes (dyn_string) → valueType ("Bool","Int","Real","String","StructArray1","UDT1",...)
 * - Browse.ItemLengths (dyn_int) → itemLength (-1 = simple, >0 = array size or string length+2)
 */
export interface S7PlusBrowseNode {
  /** Symbolic path in TIA project (e.g., data block name, variable path) */
  path: string;

  /** Variable/block comment (multi-language, first available) */
  comment?: string;

  /** PLC system type classification: "Station","Block","Tag","Variable","Array","ComplexTag","Type" */
  systemType?: string;

  /** PLC value type name: "Bool","Int","Real","String","StructArray1","UDT1", etc. */
  valueType?: string;

  /** Data item length: -1 = simple/scalar, >0 = array dimension or string max length+2 */
  itemLength?: number;

  /**
   * Whether this node can be browsed further (has child nodes).
   * Determined from systemType: container types like "Station","Block","ComplexTag","Type"
   * can be browsed deeper, while "Variable","Tag","Array" are leaf nodes.
   */
  hasChildren?: boolean;
}

/**
 * S7Plus Browse Result
 * Returned by the browse operation with pagination support.
 */
export interface S7PlusBrowseResult {
  /** Array of browse nodes for the current page */
  nodes: S7PlusBrowseNode[];

  /** Total number of nodes found (before pagination) */
  totalNodes: number;

  /** Whether more results are available beyond this page */
  isPartial: boolean;

  /** Human-readable warning or guidance message */
  warning?: string;

  /** Current page starting offset */
  offset: number;

  /** Maximum nodes per page */
  limit: number;

  /** Whether there are more pages after this one */
  hasMore: boolean;

  /** Offset to use for the next page (null if no more pages) */
  nextOffset: number | null;
}
