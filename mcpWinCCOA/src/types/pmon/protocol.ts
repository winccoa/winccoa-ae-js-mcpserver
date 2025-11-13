/**
 * Pmon Protocol Type Definitions
 *
 * Type definitions for WinCC OA Process Monitor (Pmon) TCP protocol communication.
 */

/**
 * Manager state enum
 * Based on Pmon protocol specification
 */
export enum ManagerState {
  /** Manager is stopped */
  Stopped = 0,
  /** Manager is initializing */
  Init = 1,
  /** Manager is running */
  Running = 2,
  /** Manager is blocked (no alive sign) */
  Blocked = 3
}

/**
 * Manager start mode enum
 */
export enum ManagerStartMode {
  /** Manager must be started manually */
  Manual = 0,
  /** Manager starts only once when project starts */
  Once = 1,
  /** Manager starts automatically and restarts on crash */
  Always = 2
}

/**
 * Pmon operation mode
 */
export enum PmonMode {
  /** Pmon is starting managers */
  StartMode = 0,
  /** Pmon is monitoring managers */
  MonitorMode = 1,
  /** Pmon is waiting for commands */
  WaitMode = 2,
  /** Pmon is restarting managers */
  RestartMode = 3,
  /** Pmon is shutting down */
  ShutdownMode = 4
}

/**
 * Manager information from MGRLIST:STATI response
 */
export interface PmonManager {
  /** Manager index (starting from 0 for Pmon itself) */
  index: number;
  /** Manager name (e.g., WCCOActrl, WCCOAui) */
  name?: string;
  /** Current state of the manager */
  state: ManagerState;
  /** Process ID */
  pid: number;
  /** Start mode configuration */
  startMode: ManagerStartMode;
  /** Start time (e.g., "2025.01.23 10:30:15.123") */
  startTime: string;
  /** Manager number assigned by Data manager */
  manNum: number;
}

/**
 * Complete Pmon status information
 */
export interface PmonStatus {
  /** List of all managers */
  managers: PmonManager[];
  /** Current Pmon mode (numeric) */
  modeNumeric: number;
  /** Current Pmon mode (string representation) */
  modeString: string;
  /** Emergency mode active (0=no, 1=yes) */
  emergencyActive: number;
  /** Demo mode active (0=no, 1=yes) */
  demoModeActive: number;
}

/**
 * Manager properties from PROP_GET
 */
export interface ManagerProperties {
  /** Start mode (manual, once, always) */
  startMode: string;
  /** Seconds to wait before sending SIGKILL */
  secKill: number;
  /** Number of restart attempts */
  restartCount: number;
  /** Minutes to reset restart counter */
  resetMin: number;
  /** Command line options */
  commandlineOptions: string;
}

/**
 * Manager list entry from MGRLIST:LIST
 */
export interface ManagerListEntry {
  /** Manager index */
  index: number;
  /** Manager name */
  manager: string;
  /** Start mode (manual, once, always) */
  startMode: string;
  /** Seconds to kill */
  secKill: number;
  /** Restart count */
  restartCount: number;
  /** Reset minutes */
  resetMin: number;
  /** Command line options */
  commandlineOptions: string;
}

/**
 * Pmon command response
 */
export interface PmonResponse {
  /** Whether the command was successful */
  success: boolean;
  /** Response data (raw or parsed) */
  data?: any;
  /** Error message if failed */
  error?: string;
}

/**
 * Pmon client configuration
 */
export interface PmonConfig {
  /** Pmon host (default: localhost) */
  host?: string;
  /** Pmon port (default: 4999) */
  port?: number;
  /** Authentication user (optional) */
  user?: string;
  /** Authentication password (optional) */
  password?: string;
  /** Connection timeout in milliseconds (default: 5000) */
  timeout?: number;
}
