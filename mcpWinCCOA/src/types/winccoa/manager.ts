/**
 * WinCC OA Manager Types
 *
 * Type definitions for the WinccoaManager class from winccoa-manager package.
 * These types extend or re-export types from the package.
 */

/**
 * Re-export WinccoaManager from the package
 * This allows us to use the official types from winccoa-manager
 */
export type { WinccoaManager } from 'winccoa-manager';

/**
 * Datapoint configuration for address settings
 */
export interface DpAddressConfig {
  _type: number;
  _drv_ident: string;
  _connection?: string;    // Optional - OPC UA doesn't use it!
  _reference: string;
  _internal: boolean;
  _direction: number;
  _datatype: number;      // OPC UA transformation type (750-768)
  _subindex: number;      // Subindex (0 for OPC UA)
  _lowlevel?: boolean;    // Low-level comparison (onDataChange)
  _offset?: number;       // Offset for historical data
  _poll_group?: string;   // Subscription/poll group name
  _active?: boolean;      // Active flag (usually set separately)
}

/**
 * Datapoint configuration for distribution (manager allocation)
 * This is a separate config parallel to _address
 */
export interface DpDistribConfig {
  _type: number;
  _driver: number;
}

/**
 * Datapoint element type enum (subset of WinCC OA types)
 */
export enum DpElementType {
  /** Invalid type */
  Invalid = 0,
  /** Boolean */
  Bool = 1,
  /** Character */
  Char = 2,
  /** Integer */
  Int = 3,
  /** Unsigned integer */
  UInt = 4,
  /** Float */
  Float = 5,
  /** Bit (32-bit bitfield) */
  Bit = 6,
  /** Text/String */
  Text = 7,
  /** Time value */
  Time = 8,
  /** Blob (binary large object) */
  Blob = 9,
  /** Unsigned char */
  UChar = 10,
  /** Long integer */
  Long = 11,
  /** Unsigned long */
  ULong = 12,
  /** 64-bit integer */
  Int64 = 13,
  /** Unsigned 64-bit integer */
  UInt64 = 14,
  /** Dynamic array */
  DynAny = 15
}
