/**
 * OPC UA Connection Tools
 *
 * MCP tools for creating and browsing OPC UA connections.
 */

import { z } from 'zod';
import OpcUaConnection from '../../helpers/drivers/OpcUaConnection.js';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register OPC UA Connection tools (add-connection, browse)
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const opcua = new OpcUaConnection();

  // Tool 1: Add OPC UA Connection
  server.tool(
    "opcua-add-connection",
    `Creates and configures a new OPC UA client connection to an OPC UA server.

    This tool establishes a connection to an OPC UA server by creating the necessary WinCC OA datapoints,
    configuring the connection parameters, and registering it with the specified OPC UA manager.

    The connection is automatically added to the running OPC UA driver using the AddServer command,
    eliminating the need for a driver restart in most cases. If the driver is not running or the command
    fails, the connection will be available after the next driver start.

    Connection Naming:
    Connection names are automatically generated in sequential format: _OpcUAConnection1, _OpcUAConnection2, etc.
    The system ensures uniqueness by checking existing datapoints.

    Required parameters:
    - ipAddress: IP address or hostname of the OPC UA server
    - port: Port number of the OPC UA server (typically 4840)
    - managerNumber: WinCC OA manager number (1-99) for this connection (e.g., 4 for _OPCUA4)

    Optional parameters:
    - reconnectTimer: Seconds before reconnection attempt (default: 10)
    - securityPolicy: Security policy enum (0=None, 2=Basic128Rsa15, 3=Basic256, 4=Basic256Sha256, 5=Aes128Sha256RsaOaep, 6=Aes256Sha256RsaPss)
    - messageSecurityMode: Message security mode (0=None, 1=Sign, 2=SignAndEncrypt)
    - username: Username for authentication
    - password: Password for authentication
    - clientCertificate: Client certificate name
    - separator: Separator for display names (default: ".")
    - enableConnection: Enable connection immediately (default: true)

    Returns: The auto-generated connection name (e.g., "_OpcUAConnection1") on success.`,
    {
      ipAddress: z.string().describe('IP address or hostname of the OPC UA server'),
      port: z.number().min(1).max(65535).describe('Port number of the OPC UA server'),
      managerNumber: z.number().min(1).max(99).describe('WinCC OA manager number (1-99)'),
      reconnectTimer: z.number().positive().optional().describe('Reconnect timer in seconds (default: 10)'),
      securityPolicy: z
        .number()
        .min(0)
        .max(6)
        .optional()
        .describe('Security policy: 0=None, 2=Basic128Rsa15, 3=Basic256, 4=Basic256Sha256, 5=Aes128Sha256RsaOaep, 6=Aes256Sha256RsaPss'),
      messageSecurityMode: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe('Message security mode: 0=None, 1=Sign, 2=SignAndEncrypt'),
      username: z.string().optional().describe('Username for authentication'),
      password: z.string().optional().describe('Password for authentication'),
      clientCertificate: z.string().optional().describe('Client certificate name'),
      separator: z.string().optional().describe('Separator for display names (default: ".")'),
      enableConnection: z.boolean().optional().describe('Enable connection immediately (default: true)')
    },
    async (params: any) => {
      try {
        console.log('Adding OPC UA connection:', params);

        // Call the addConnection method
        const connectionName = await opcua.addConnection(params);

        console.log(`Successfully created OPC UA connection: ${connectionName}`);
        return createSuccessResponse({
          connectionName,
          serverUrl: `opc.tcp://${params.ipAddress}:${params.port}`,
          managerNumber: params.managerNumber,
          message: 'OPC UA connection created and configured successfully'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error adding OPC UA connection:', error);
        return createErrorResponse(`Failed to add OPC UA connection: ${errorMessage}`, {
          details: errorMessage,
          stack: errorStack
        });
      }
    }
  );

  // Tool 2: Browse OPC UA Address Space
  server.tool(
    "opcua-browse",
    `Browses the OPC UA address space with smart auto-depth selection.

    This tool intelligently navigates through the OPC UA server's address space hierarchy,
    automatically optimizing depth based on address space size to stay within the 800-node limit.

    PREREQUISITES:
    - OPC UA connection must be established (Common.State.ConnState >= 256)
    - If connection is not active, browse will fail with descriptive error showing current state
    - Use 'opcua-add-connection' tool to create connections if needed
    - Note: Common.State.ConnState uses unified driver state (< 256 = not connected, >= 256 = connected)

    SMART AUTO-DEPTH BEHAVIOR (when depth not specified):

    For ROOT NODES (ns=0;i=85 Objects folder):
    - Conservative approach: tries depth=2 first
    - If result > 800 nodes, automatically retries with depth=1
    - Returns actualDepthUsed in response (1 or 2)
    - Identifies large branches for further exploration

    For SPECIFIC BRANCHES (user browsing a particular node):
    - FULL RECURSIVE EXPLORATION: Browses entire branch to all leaf nodes
    - Uses depth-first exploration with batched API calls (minimizes calls)
    - Continues until reaching leaf nodes OR hitting 1000-node hard limit
    - Returns recursionStats showing maxDepthReached, leafNodesReached, totalApiCalls
    - Returns exploredBranches (fully explored) and expandableBranches (hit limit)
    - Uses hasChildren field to intelligently skip leaf nodes
    - Allows exploring complete branches within budget

    EXAMPLE AUTO-DEPTH RESPONSES:
    1. Browsing ROOT (ns=0;i=85) - Small address space:
       Returns depth=2 results with all children expanded

    2. Browsing ROOT (ns=0;i=85) - Large address space:
       Returns depth=1 results with message:
       "Auto-adjusted from depth=2 to depth=1 to stay under 800-node limit.
        Large branches detected:
        - ns=2;s=Production (browse this node for its 5000+ children)
        - ns=2;s=Quality (browse this node for its 2000+ children)"

    3. Browsing SPECIFIC BRANCH (ns=2;s=Production):
       Returns full recursive exploration:
       "Soft limit reached (876/800 nodes). Fully explored: Machines, Conveyors, Packaging.
        Not explored (2 branches): Quality, Maintenance. Browse these individually."
       recursionStats: { maxDepthReached: 6, leafNodesReached: 423, totalApiCalls: 7 }

    4. User-specified depth validation:
       If depth is explicitly specified and would exceed 800 nodes, request is REJECTED with:
       "Address space is large (120 direct children). depth=3 would return 10,000+ nodes.
        Maximum depth allowed: 2. Use depth=1 or depth=2."

    Parameters:
    - connectionName: Name of the OPC UA connection (e.g., "_OpcUAConnection1" or "OpcUAConnection1")
    - parentNodeId: Node ID to browse from (optional, default: "ns=0;i=85" which is the Objects folder)
    - eventSource: Type of nodes to browse (optional, default: 0)
      - 0 = Value nodes (variables with values)
      - 1 = Event nodes
      - 2 = Alarm & Condition nodes
    - depth: Number of levels to browse (optional, AUTO-SELECTED if omitted)
      - If OMITTED: Smart auto-depth (tries 2, falls back to 1 if needed)
      - If SPECIFIED: 1-5 allowed, validated against address space size
      - depth=0 is DISABLED for safety
    - useCache: Use cached results if available (optional, default: true)
      Cached results are instant (0ms) vs 2-5 seconds for fresh requests
      Cache TTL is 5 minutes
    - refreshCache: Force refresh cached data (optional, default: false)
      Set to true to ignore cache and fetch fresh data from server

    Common parent node IDs:
    - "ns=0;i=85" - Objects folder (default, contains most server data)
    - "ns=0;i=86" - Types folder
    - "ns=0;i=87" - Views folder
    - "ns=0;i=84" - Root folder

    Returns: Browse result with MINIMAL node information and smart guidance:

    Node fields (lightweight, ~50% smaller payload):
    - displayName: Human-readable name
    - nodeId: Unique OPC UA node identifier
    - nodeClass: Node class (Variable, Object, Method, etc.)
    - hasChildren: Boolean flag indicating if node has children

    Smart guidance fields (NEW):
    - actualDepthUsed: What depth was actually used (1 or 2)
    - largeBranches: Array of branches with many children (if detected)
      Each branch includes: nodeId, displayName, estimatedChildren, level
    - expandableBranches: Branches not expanded due to 800-node limit
    - warning: Human-readable guidance on what to browse next

    Pagination support:
    - Default limit: 800 nodes per request (optimal for context window)
    - Response includes: totalNodes, hasMore, nextOffset
    - Use offset and limit for pagination if needed

    Performance & Best Practices:
    - Omit depth parameter for smart auto-depth (recommended for most cases)
    - Specify depth only when you need exact control
    - Auto-depth uses shared cache ('auto' key) for faster responses
    - When browsing large branches, browse each branch individually
    - Follow guidance in largeBranches field for next steps`,
    {
      connectionName: z.string().describe('Name of the OPC UA connection'),
      parentNodeId: z.string().optional().describe('Parent node ID to browse from (default: "ns=0;i=85" for Objects folder)'),
      eventSource: z
        .enum(['0', '1', '2'])
        .or(z.number().min(0).max(2))
        .optional()
        .describe('Event source type: 0=Value, 1=Event, 2=Alarm&Condition'),
      depth: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('Number of levels to browse (OPTIONAL - OMIT FOR FULL BRANCH EXPLORATION).\n\nWhen OMITTED (RECOMMENDED for branches):\n- Root nodes (ns=0;i=85): Conservative auto-depth, tries depth=2 first, falls back to depth=1 if needed\n- Specific branches: FULL RECURSIVE EXPLORATION to all leaf nodes\n  * Uses depth-first exploration with batched API calls (minimizes WinCC OA calls)\n  * Continues until reaching leaf nodes OR hitting 1000-node hard limit\n  * Returns recursionStats (maxDepthReached, leafNodesReached, totalApiCalls)\n  * Returns exploredBranches (fully explored) and expandableBranches (hit limit)\n  * Uses hasChildren field to intelligently skip leaf nodes\n  * Soft limit: 800 nodes (completes current branch), Hard limit: 1000 nodes (absolute stop)\n\nWhen SPECIFIED (less flexible):\n- 1-5 allowed, validated against address space size\n- Uses fixed depth (does NOT explore to leaf nodes)\n- Not recommended for branch exploration\n\nIMPORTANT: To browse a complete branch to all leaf nodes, ALWAYS OMIT the depth parameter.'),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Starting position for pagination (default: 0). Skip first N nodes. Use with limit for pagination.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(800)
        .optional()
        .describe('Maximum nodes to return per page (default: 800, max: 800). Use with offset for pagination.'),
      useCache: z
        .boolean()
        .optional()
        .describe('Use cached results if available (default: true). Cache TTL: 5 minutes.'),
      refreshCache: z
        .boolean()
        .optional()
        .describe('Force refresh cached data (default: false)')
    },
    async ({
      connectionName,
      parentNodeId,
      eventSource,
      depth,
      offset,
      limit,
      useCache,
      refreshCache
    }: {
      connectionName: string;
      parentNodeId?: string;
      eventSource?: '0' | '1' | '2' | number;
      depth?: number;
      offset?: number;
      limit?: number;
      useCache?: boolean;
      refreshCache?: boolean;
    }) => {
      try {
        // Validate depth parameter if specified
        if (depth !== undefined && (depth < 1 || depth > 5)) {
          return createErrorResponse(
            `Invalid depth parameter: ${depth}. ` +
            `Depth must be between 1 and 5, or omit for smart auto-depth. ` +
            `depth=0 (unlimited browsing) is disabled for safety to prevent crashes on large address spaces (>10K nodes). ` +
            `For large hierarchies, omit depth parameter to use smart auto-depth selection.`,
            {
              invalidDepth: depth,
              allowedRange: '1-5 or undefined',
              suggestion: 'Omit depth parameter for smart auto-depth, or use depth=1-5 for explicit control'
            }
          );
        }

        console.log('Browsing OPC UA connection:', {
          connectionName,
          parentNodeId,
          eventSource,
          depth: depth === undefined ? 'auto' : depth,
          useCache: useCache ?? true,
          refreshCache: refreshCache ?? false
        });

        // Convert eventSource to number if it's a string
        const eventSourceNum = eventSource !== undefined ? (typeof eventSource === 'string' ? parseInt(eventSource) : eventSource) : 0;

        // Call the browse method with pagination parameters (depth undefined = auto-depth)
        const browseResult = await opcua.browse(
          connectionName,
          parentNodeId,
          eventSourceNum as 0 | 1 | 2,
          depth, // Pass undefined through for auto-depth
          useCache ?? true,
          refreshCache ?? false,
          undefined, // maxNodeCount (use default 800)
          offset ?? 0,
          limit
        );

        console.log(`Found ${browseResult.nodes.length} nodes (page ${(offset ?? 0) / (limit ?? 600)} of browse)${browseResult.isPartial ? ' - more available' : ''}`);

        // Build response with pagination metadata
        const response: any = {
          connectionName,
          parentNodeId: parentNodeId || 'ns=0;i=85',
          nodeCount: browseResult.nodes.length,
          cached: useCache && !refreshCache ? 'possibly from cache' : 'fresh data',
          nodes: browseResult.nodes
        };

        // Add requested depth if specified by user
        if (depth !== undefined) {
          response.requestedDepth = depth;
        }

        // Add pagination metadata
        if (browseResult.totalNodes !== undefined) {
          response.totalNodes = browseResult.totalNodes;
        }
        if (browseResult.offset !== undefined) {
          response.offset = browseResult.offset;
        }
        if (browseResult.limit !== undefined) {
          response.limit = browseResult.limit;
        }
        if (browseResult.hasMore !== undefined) {
          response.hasMore = browseResult.hasMore;
        }
        if (browseResult.nextOffset !== undefined && browseResult.nextOffset !== null) {
          response.nextOffset = browseResult.nextOffset;
        }

        // Add warning if partial
        if (browseResult.isPartial && browseResult.warning) {
          response.isPartial = true;
          response.warning = browseResult.warning;
        }

        // Add smart guidance fields
        if (browseResult.actualDepthUsed !== undefined) {
          response.actualDepthUsed = browseResult.actualDepthUsed;
        }
        if (browseResult.largeBranches && browseResult.largeBranches.length > 0) {
          response.largeBranches = browseResult.largeBranches;
        }
        if (browseResult.expandableBranches && browseResult.expandableBranches.length > 0) {
          response.expandableBranches = browseResult.expandableBranches;
        }

        return createSuccessResponse(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error browsing OPC UA connection:', error);
        return createErrorResponse(`Failed to browse OPC UA connection: ${errorMessage}`, {
          connectionName,
          details: errorMessage,
          stack: errorStack
        });
      }
    }
  );

  // Tool 3: Delete OPC UA Connection
  server.tool(
    "opcua-delete-connection",
    `Completely deletes an existing OPC UA client connection from WinCC OA.

    This tool removes an OPC UA connection by:
    1. Removing the connection from the manager's server list (_OPCUA{num}.Config.Servers)
    2. Permanently deleting the connection datapoint (_OpcUAConnection{X})
    3. If no connections remain on the driver:
       - Stops the OPC UA driver
       - Removes the driver from Pmon
       - Deletes the _OPCUA{num} manager datapoint
    4. Cleans up any other unused _OPCUA{num} datapoints (those with empty server lists)

    This provides complete automatic cleanup - if you delete the last connection on a driver,
    the entire OPC UA infrastructure (driver + manager datapoint) will be automatically removed.
    Additionally, any orphaned manager datapoints with no connections will also be cleaned up.

    Note: The OPC UA driver may need to be restarted for the changes to take full effect,
    or will reload automatically if configured to do so.

    Required parameters:
    - connectionName: Name of the connection to delete (e.g., "_OpcUAConnection1" or "OpcUAConnection1")

    Optional parameters:
    - managerNumber: Manager number (1-99). If not specified, will be auto-detected from the connection's registration.

    Returns: Success message with deleted connection details.

    CAUTION: This operation permanently deletes the connection and cannot be undone.
    If this is the last connection, the entire OPC UA infrastructure will be removed.
    All unused manager datapoints will also be cleaned up.
    Make sure you really want to delete this connection.`,
    {
      connectionName: z.string().describe('Name of the OPC UA connection to delete (with or without _ prefix)'),
      managerNumber: z.number().min(1).max(99).optional().describe('WinCC OA manager number (1-99), auto-detected if not specified')
    },
    async ({ connectionName, managerNumber }: { connectionName: string; managerNumber?: number }) => {
      try {
        console.log('Deleting OPC UA connection:', { connectionName, managerNumber });

        // Call the deleteConnection method
        await opcua.deleteConnection(connectionName, managerNumber);

        console.log(`Successfully deleted OPC UA connection: ${connectionName}`);
        return createSuccessResponse({
          connectionName,
          managerNumber: managerNumber || 'auto-detected',
          message: 'OPC UA connection deleted successfully'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error deleting OPC UA connection:', error);
        return createErrorResponse(`Failed to delete OPC UA connection: ${errorMessage}`, {
          connectionName,
          details: errorMessage,
          stack: errorStack
        });
      }
    }
  );

  return 3; // Number of tools registered
}
