/**
 * OPC UA Browse Types
 *
 * Type definitions for browsing OPC UA address space.
 */

/**
 * OPC UA Browse Node
 * Represents a node in the OPC UA address space hierarchy
 */
export interface BrowseNode {
  /** Human-readable display name */
  displayName: string;

  /** Browse path in the address space hierarchy */
  browsePath: string;

  /** Unique OPC UA node identifier */
  nodeId: string;

  /** Data type of the node (if applicable) */
  dataType: string;

  /** Value rank (scalar, array, etc.) */
  valueRank?: string;

  /** Node class (Variable, Object, Method, etc.) */
  nodeClass?: string;
}

/**
 * Event source type for browsing
 */
export enum BrowseEventSource {
  /** Value nodes (variables with values) */
  Value = 0,
  /** Event nodes */
  Event = 1,
  /** Alarm & Condition nodes */
  AlarmCondition = 2
}

/**
 * Browse request parameters
 */
export interface BrowseRequest {
  /** Connection name */
  connectionName: string;

  /** Parent node ID to browse from */
  parentNodeId?: string;

  /** Event source type */
  eventSource?: BrowseEventSource;

  /** Unique request ID for tracking */
  requestId?: string;
}

/**
 * Browse response
 */
export interface BrowseResponse {
  /** Connection name */
  connectionName: string;

  /** Parent node ID that was browsed */
  parentNodeId: string;

  /** Number of nodes found */
  nodeCount: number;

  /** Array of browse nodes */
  nodes: BrowseNode[];

  /** Request ID for tracking */
  requestId?: string;
}
