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

    Required parameters:
    - ipAddress: IP address or hostname of the OPC UA server
    - port: Port number of the OPC UA server (typically 4840)
    - managerNumber: WinCC OA manager number (1-99) for this connection (e.g., 4 for _OPCUA4)

    Optional parameters:
    - connectionName: Custom name for the connection (MUST start with underscore, e.g., "_TestConnection"). Auto-generated if not specified.
    - reconnectTimer: Seconds before reconnection attempt (default: 10)
    - securityPolicy: Security policy enum (0=None, 2=Basic128Rsa15, 3=Basic256, 4=Basic256Sha256, 5=Aes128Sha256RsaOaep, 6=Aes256Sha256RsaPss)
    - messageSecurityMode: Message security mode (0=None, 1=Sign, 2=SignAndEncrypt)
    - username: Username for authentication
    - password: Password for authentication
    - clientCertificate: Client certificate name
    - separator: Separator for display names (default: ".")
    - enableConnection: Enable connection immediately (default: true)

    Returns: The connection name (e.g., "_OpcUAConnection1") on success.`,
    {
      ipAddress: z.string().describe('IP address or hostname of the OPC UA server'),
      port: z.number().min(1).max(65535).describe('Port number of the OPC UA server'),
      managerNumber: z.number().min(1).max(99).describe('WinCC OA manager number (1-99)'),
      connectionName: z.string().optional().describe('Custom connection name (MUST start with underscore, e.g., "_TestConnection"). Auto-generated if not specified'),
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
    `Browses the OPC UA address space of an existing connection and returns the child nodes.

    This tool allows you to navigate through the OPC UA server's address space hierarchy,
    exploring available nodes, variables, objects, and their properties.

    Parameters:
    - connectionName: Name of the OPC UA connection (e.g., "_OpcUAConnection1" or "OpcUAConnection1")
    - parentNodeId: Node ID to browse from (optional, default: "ns=0;i=85" which is the Objects folder)
    - eventSource: Type of nodes to browse (optional, default: 0)
      - 0 = Value nodes (variables with values)
      - 1 = Event nodes
      - 2 = Alarm & Condition nodes

    Common parent node IDs:
    - "ns=0;i=85" - Objects folder (default, contains most server data)
    - "ns=0;i=86" - Types folder
    - "ns=0;i=87" - Views folder
    - "ns=0;i=84" - Root folder

    Returns: Array of nodes with the following information for each:
    - displayName: Human-readable name
    - browsePath: Path in the address space hierarchy
    - nodeId: Unique OPC UA node identifier
    - dataType: Data type of the node (if applicable)
    - valueRank: Value rank (scalar, array, etc.)
    - nodeClass: Node class (Variable, Object, Method, etc.)`,
    {
      connectionName: z.string().describe('Name of the OPC UA connection'),
      parentNodeId: z.string().optional().describe('Parent node ID to browse from (default: "ns=0;i=85" for Objects folder)'),
      eventSource: z
        .enum(['0', '1', '2'])
        .or(z.number().min(0).max(2))
        .optional()
        .describe('Event source type: 0=Value, 1=Event, 2=Alarm&Condition')
    },
    async ({ connectionName, parentNodeId, eventSource }: { connectionName: string; parentNodeId?: string; eventSource?: '0' | '1' | '2' | number }) => {
      try {
        console.log('Browsing OPC UA connection:', { connectionName, parentNodeId, eventSource });

        // Convert eventSource to number if it's a string
        const eventSourceNum = eventSource !== undefined ? (typeof eventSource === 'string' ? parseInt(eventSource) : eventSource) : 0;

        // Call the browse method
        const nodes = await opcua.browse(connectionName, parentNodeId, eventSourceNum as 0 | 1 | 2);

        console.log(`Found ${nodes.length} nodes in OPC UA address space`);
        return createSuccessResponse({
          connectionName,
          parentNodeId: parentNodeId || 'ns=0;i=85',
          nodeCount: nodes.length,
          nodes
        });
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

  return 2; // Number of tools registered
}
