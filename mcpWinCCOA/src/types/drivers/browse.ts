/**
 * OPC UA Browse Types
 *
 * Type definitions for browsing OPC UA address space.
 */

/**
 * OPC UA Browse Node (Minimal Response)
 * Represents a node in the OPC UA address space hierarchy with minimal fields for performance
 *
 * For detailed node information (browsePath, dataType, valueRank, description, etc.),
 * use the opcua-get-node-details tool with the nodeId
 */
export interface BrowseNode {
  /** Human-readable display name */
  displayName: string;

  /** Unique OPC UA node identifier (use this for opcua-get-node-details) */
  nodeId: string;

  /** Node class (Variable, Object, Method, ObjectType, VariableType, etc.) */
  nodeClass: string;

  /** Indicates if this node has child nodes (for tree UI navigation) */
  hasChildren?: boolean;

  /** Child nodes (populated when browsing with depth > 1) */
  children?: BrowseNode[];
}

/**
 * Branch information for large address space analysis
 * Used to identify and report branches that have many children
 */
export interface BranchInfo {
  /** Node ID of the branch */
  nodeId: string;

  /** Human-readable display name */
  displayName: string;

  /** Estimated number of children in this branch */
  estimatedChildren: number;

  /** Hierarchy level (1 = direct child, 2 = grandchild, etc.) */
  level: number;

  /** Browse path showing full hierarchy */
  browsePath?: string;
}

/**
 * Recursion statistics for full-branch browsing
 * Provides insights into how deeply the branch was explored
 */
export interface RecursionStats {
  /** Maximum depth level reached during recursion */
  maxDepthReached: number;

  /** Total number of levels explored */
  totalLevelsExplored: number;

  /** Number of leaf nodes (nodes with no children) reached */
  leafNodesReached: number;

  /** Total number of API calls made */
  totalApiCalls: number;
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

  /** Warning message if results are partial */
  warning?: string;

  /** True if results were truncated due to limits */
  isPartial?: boolean;

  /** Limit that was applied (if any) */
  appliedLimit?: number;
}

/**
 * Browse result with metadata
 * Internal type for browse operations with limit tracking and pagination
 */
export interface BrowseResult {
  /** Array of browse nodes (current page) */
  nodes: BrowseNode[];

  /** True if results were truncated due to limits */
  isPartial: boolean;

  /** Warning message if results are partial */
  warning?: string;

  /** Limit that caused truncation */
  appliedLimit?: number;

  /** Total number of nodes found (before pagination) */
  totalNodes?: number;

  /** Current starting offset (for pagination) */
  offset?: number;

  /** Current limit applied (for pagination) */
  limit?: number;

  /** True if more nodes are available on next page */
  hasMore?: boolean;

  /** Offset to use for next page (null if no more pages) */
  nextOffset?: number | null;

  /** Internal: Full results before pagination (for caching) */
  _fullResults?: BrowseNode[];

  /** Actual depth used in browsing (may differ from requested if auto-adjusted) */
  actualDepthUsed?: number;

  /** Large branches detected (> 100 estimated children) */
  largeBranches?: BranchInfo[];

  /** Branches that weren't expanded due to node limit constraints */
  expandableBranches?: BranchInfo[];

  /** Branches that were fully explored to leaf nodes */
  exploredBranches?: string[];

  /** Recursion statistics (for full-branch browsing) */
  recursionStats?: RecursionStats;
}
