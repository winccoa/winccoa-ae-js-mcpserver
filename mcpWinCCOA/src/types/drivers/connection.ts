/**
 * Base Driver Connection Types
 *
 * Generic types shared by all driver connections.
 * Note: DpAddressConfig and DpDistribConfig are defined in winccoa/manager.ts
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
 * Common connection state values (unified across drivers)
 * Values < 256 = not connected, >= 256 = connected
 */
export enum CommonConnectionState {
  /** Not initialized */
  NotInitialized = -1,
  /** Undefined state */
  Undefined = 0,
  /** Not connected */
  NotConnected = 1,
  /** Connecting in progress */
  Connecting = 2,
  /** Connection not active */
  NotActive = 3,
  /** Disconnecting in progress */
  Disconnecting = 4,
  /** Connection failure */
  Failure = 5,
  /** Waiting for reconnect */
  WaitForReconnect = 9,
  /** Connected (base value) */
  Connected = 256,
  /** Connected - First device, first connection active */
  ConnectedFirstFirst = 257,
  /** Connected - First device, second connection active */
  ConnectedFirstSecond = 258,
  /** Connected - Second device, first connection active */
  ConnectedSecondFirst = 259,
  /** Connected - Second device, second connection active */
  ConnectedSecondSecond = 260,
  /** General query running */
  GeneralQueryRunning = 261,
  /** Info query running */
  InfoQueryRunning = 262
}
