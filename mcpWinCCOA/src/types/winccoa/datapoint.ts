/**
 * WinCC OA Datapoint Types
 *
 * Type definitions for WinCC OA datapoints, elements, and values.
 */

/**
 * Valid datapoint value types
 */
export type DatapointValue = string | number | boolean | Buffer | any[] | null | undefined;

/**
 * Datapoint element information
 */
export interface DatapointElement {
  /** Element name */
  name: string;
  /** Element type ID */
  type?: number;
  /** Element type name */
  typeName?: string;
  /** Engineering unit */
  unit?: string;
  /** Description */
  description?: string;
  /** Child elements */
  children?: DatapointElement[];
  /** Full path to element */
  path?: string;
}

/**
 * Datapoint type definition
 */
export interface DatapointType {
  /** Type name */
  name: string;
  /** Type ID */
  id?: number;
  /** Elements in this type */
  elements?: DatapointElement[];
  /** Whether this is a system type (starts with _) */
  isSystem?: boolean;
}

/**
 * Datapoint instance information
 */
export interface DatapointInstance {
  /** Datapoint name */
  name: string;
  /** Type name */
  type: string;
  /** System ID */
  systemId?: number;
  /** Description */
  description?: string;
  /** Structure with all elements */
  structure?: DatapointElement[];
}

/**
 * Datapoint child element (used in nested structures)
 */
export interface DatapointChild {
  /** Element name */
  name: string;
  /** Full path */
  path?: string;
  /** Child elements */
  children?: DatapointChild[];
  /** Engineering unit */
  unit?: string;
  /** Description */
  description?: string;
}

/**
 * Datapoint query result
 */
export interface DatapointQueryResult {
  /** Matching datapoints */
  datapoints: DatapointInstance[];
  /** Total count (for pagination) */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
}
