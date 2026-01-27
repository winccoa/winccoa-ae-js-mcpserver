/**
 * MQTT Connection Tools
 *
 * MCP tools for creating and managing MQTT connections.
 */

import { z } from "zod";
import {
  MqttConnection,
  MqttConnectionType,
  MQTT_DEFAULTS,
} from "../../helpers/drivers/MqttConnection.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../utils/helpers.js";
import type { ServerContext } from "../../types/index.js";

/**
 * Register MQTT Connection tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const mqtt = new MqttConnection();

  // ============================================================================
  // Tool 1: Add MQTT Connection (Unsecure)
  // ============================================================================
  server.tool(
    "mqtt-add-connection",
    `Creates and configures a new MQTT client connection to an MQTT broker.

    This tool establishes an UNSECURE connection (no TLS) to an MQTT broker.
    For secure connections with TLS or username/password, use mqtt-add-connection-auth.

    Connection Naming:
    Connection names are automatically generated: _MqttConnection1, _MqttConnection2, etc.

    Required parameters:
    - host: Hostname or IP address of the MQTT broker
    - port: Port number (default: 1883 for unsecure)

    Optional parameters:
    - managerNumber: WinCC OA MQTT driver number (1-99). If not specified, uses the lowest available MQTT driver.
    - keepAliveInterval: Keep alive interval in seconds (default: 20)
    - reconnectInterval: Reconnect interval in seconds (default: 20)
    - persistentSession: Use persistent MQTT session (default: true)
    - enableConnection: Enable connection immediately (default: true)
    - clientId: Custom client ID (auto-generated if not provided)
    - jsonProfiles: Array of JSON profile strings for value transformation. Each profile maps WinCC OA attributes to JSON keys.
      Examples:
      - Value only: {"name":"Value","_value":"Value"}
      - Value & Timestamp: {"name":"Value & Timestamp","_value":"Value","_stime":"Time"}
      - Value, Timestamp & Status: {"name":"Value, Timestamp & Status","_value":"Value","_status64":"Status","_stime":"Time"}

    Returns: The auto-generated connection name on success.`,
    {
      host: z.string().describe("Hostname or IP address of the MQTT broker"),
      port: z
        .number()
        .min(1)
        .max(65535)
        .default(1883)
        .describe("Port number (default: 1883)"),
      managerNumber: z
        .number()
        .min(1)
        .max(99)
        .optional()
        .describe("WinCC OA MQTT driver number (1-99). If not specified, uses lowest available MQTT driver."),
      keepAliveInterval: z
        .number()
        .positive()
        .optional()
        .describe("Keep alive interval in seconds (default: 20)"),
      reconnectInterval: z
        .number()
        .positive()
        .optional()
        .describe("Reconnect interval in seconds (default: 20)"),
      persistentSession: z
        .boolean()
        .optional()
        .describe("Use persistent MQTT session (default: true)"),
      enableConnection: z
        .boolean()
        .optional()
        .describe("Enable connection immediately (default: true)"),
      clientId: z
        .string()
        .optional()
        .describe("Custom client ID (auto-generated if not provided)"),
      jsonProfiles: z
        .array(z.string())
        .optional()
        .describe("JSON profiles for value transformation (array of JSON strings)"),
    },
    async (params: any) => {
      try {
        console.log("Adding MQTT connection (unsecure):", params);

        const result = await mqtt.addConnection({
          connectionType: MqttConnectionType.Unsecure,
          connectionString: `${params.host}:${params.port}`,
          managerNumber: params.managerNumber,
          keepAliveInterval: params.keepAliveInterval,
          reconnectInterval: params.reconnectInterval,
          persistentSession: params.persistentSession,
          enableConnection: params.enableConnection,
          clientId: params.clientId,
          jsonProfiles: params.jsonProfiles,
        });

        if (!result.success) {
          return createErrorResponse(
            `Failed to add MQTT connection: ${result.error}`,
          );
        }

        console.log(
          `Successfully created MQTT connection: ${result.connectionName}`,
        );
        return createSuccessResponse({
          connectionName: result.connectionName,
          broker: `${params.host}:${params.port}`,
          managerNumber: params.managerNumber ?? "auto-detected",
          connectionType: "Unsecure",
          message: "MQTT connection created and configured successfully",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error adding MQTT connection:", error);
        return createErrorResponse(
          `Failed to add MQTT connection: ${errorMessage}`,
        );
      }
    },
  );

  // ============================================================================
  // Tool 2: Add MQTT Connection with Authentication
  // ============================================================================
  server.tool(
    "mqtt-add-connection-auth",
    `Creates and configures a new MQTT client connection with username/password authentication.

    This tool establishes an UNSECURE connection with username/password authentication.
    For TLS encryption, set connectionType to 2 (TLS).

    Connection Types:
    - 1: Unsecure (TCP, default port 1883)
    - 2: TLS (default port 8883)
    - 3: WebSocket
    - 4: TLS-PSK

    Required parameters:
    - host: Hostname or IP address of the MQTT broker
    - port: Port number
    - username: Username for authentication
    - password: Password for authentication

    Optional parameters:
    - managerNumber: WinCC OA MQTT driver number (1-99). If not specified, uses the lowest available MQTT driver.
    - connectionType: 1=Unsecure, 2=TLS, 3=WebSocket, 4=TLS-PSK (default: 1)
    - certificate: Broker certificate file for TLS (required for connectionType 2)
    - keepAliveInterval: Keep alive interval in seconds (default: 20)
    - reconnectInterval: Reconnect interval in seconds (default: 20)
    - persistentSession: Use persistent MQTT session (default: true)
    - enableConnection: Enable connection immediately (default: true)
    - clientId: Custom client ID (auto-generated if not provided)
    - jsonProfiles: Array of JSON profile strings for value transformation. Each profile maps WinCC OA attributes to JSON keys.
      Examples:
      - Value only: {"name":"Value","_value":"Value"}
      - Value & Timestamp: {"name":"Value & Timestamp","_value":"Value","_stime":"Time"}
      - Value, Timestamp & Status: {"name":"Value, Timestamp & Status","_value":"Value","_status64":"Status","_stime":"Time"}

    Returns: The auto-generated connection name on success.`,
    {
      host: z.string().describe("Hostname or IP address of the MQTT broker"),
      port: z.number().min(1).max(65535).describe("Port number"),
      managerNumber: z
        .number()
        .min(1)
        .max(99)
        .optional()
        .describe("WinCC OA MQTT driver number (1-99). If not specified, uses lowest available MQTT driver."),
      username: z.string().describe("Username for authentication"),
      password: z.string().describe("Encrypted password for authentication (WinCC OA encrypted blob string)"),
      connectionType: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe(
          "Connection type: 1=Unsecure, 2=TLS, 3=WebSocket, 4=TLS-PSK (default: 1)",
        ),
      certificate: z
        .string()
        .optional()
        .describe("Broker certificate file for TLS"),
      keepAliveInterval: z
        .number()
        .positive()
        .optional()
        .describe("Keep alive interval in seconds (default: 20)"),
      reconnectInterval: z
        .number()
        .positive()
        .optional()
        .describe("Reconnect interval in seconds (default: 20)"),
      persistentSession: z
        .boolean()
        .optional()
        .describe("Use persistent MQTT session (default: true)"),
      enableConnection: z
        .boolean()
        .optional()
        .describe("Enable connection immediately (default: true)"),
      clientId: z
        .string()
        .optional()
        .describe("Custom client ID (auto-generated if not provided)"),
      jsonProfiles: z
        .array(z.string())
        .optional()
        .describe("JSON profiles for value transformation (array of JSON strings)"),
    },
    async (params: any) => {
      try {
        console.log("Adding MQTT connection with auth:", params);

        const connType = params.connectionType ?? MqttConnectionType.Unsecure;

        // Validate TLS requires certificate
        if (connType === MqttConnectionType.TLS && !params.certificate) {
          return createErrorResponse(
            "Certificate is required for TLS connections",
          );
        }

        const result = await mqtt.addConnection({
          connectionType: connType,
          connectionString: `${params.host}:${params.port}`,
          managerNumber: params.managerNumber,
          username: params.username,
          password: params.password,
          certificate: params.certificate,
          keepAliveInterval: params.keepAliveInterval,
          reconnectInterval: params.reconnectInterval,
          persistentSession: params.persistentSession,
          enableConnection: params.enableConnection,
          clientId: params.clientId,
          jsonProfiles: params.jsonProfiles,
        });

        if (!result.success) {
          return createErrorResponse(
            `Failed to add MQTT connection: ${result.error}`,
          );
        }

        const connTypeNames: { [key: number]: string } = {
          1: "Unsecure",
          2: "TLS",
          3: "WebSocket",
          4: "TLS-PSK",
        };

        console.log(
          `Successfully created MQTT connection: ${result.connectionName}`,
        );
        return createSuccessResponse({
          connectionName: result.connectionName,
          broker: `${params.host}:${params.port}`,
          managerNumber: params.managerNumber ?? "auto-detected",
          connectionType: connTypeNames[connType] ?? "Unknown",
          username: params.username,
          message: "MQTT connection with authentication created successfully",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error adding MQTT connection with auth:", error);
        return createErrorResponse(
          `Failed to add MQTT connection: ${errorMessage}`,
        );
      }
    },
  );

  // ============================================================================
  // Tool 3: Delete MQTT Connection
  // ============================================================================
  server.tool(
    "mqtt-delete-connection",
    `Deletes an existing MQTT connection.

    This tool removes the connection datapoint and disconnects from the broker.
    The connection will be disabled before deletion.

    Required parameters:
    - connectionName: Name of the connection to delete (e.g., "_MqttConnection1" or "MqttConnection1")

    Returns: Success status.`,
    {
      connectionName: z
        .string()
        .describe("Name of the MQTT connection to delete"),
    },
    async (params: any) => {
      try {
        console.log("Deleting MQTT connection:", params.connectionName);

        const result = await mqtt.deleteConnection(params.connectionName);

        if (!result.success) {
          return createErrorResponse(
            `Failed to delete MQTT connection: ${result.error}`,
          );
        }

        return createSuccessResponse({
          connectionName: params.connectionName,
          message: "MQTT connection deleted successfully",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error deleting MQTT connection:", error);
        return createErrorResponse(
          `Failed to delete MQTT connection: ${errorMessage}`,
        );
      }
    },
  );

  // ============================================================================
  // Tool 4: List MQTT Connections
  // ============================================================================
  server.tool(
    "mqtt-list-connections",
    `Lists all configured MQTT connections and their current states.

    Returns information about each connection including:
    - Connection name
    - Connection state (Inactive, Disconnected, Connecting, Connected, etc.)
    - Broker address (if available)

    No parameters required.`,
    {},
    async () => {
      try {
        console.log("Listing MQTT connections");

        const result = await mqtt.listConnections();

        if (!result.success) {
          return createErrorResponse(
            `Failed to list MQTT connections: ${result.error}`,
          );
        }

        return createSuccessResponse({
          count: result.connections?.length ?? 0,
          connections: result.connections,
          message: `Found ${result.connections?.length ?? 0} MQTT connection(s)`,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error listing MQTT connections:", error);
        return createErrorResponse(
          `Failed to list MQTT connections: ${errorMessage}`,
        );
      }
    },
  );

  // ============================================================================
  // Tool 5: Get MQTT Connection State
  // ============================================================================
  server.tool(
    "mqtt-get-connection-state",
    `Gets the current state of an MQTT connection.

    Connection States:
    - 0: Inactive
    - 1: Disconnected
    - 2: Connecting
    - 3: Connected
    - 4: Disconnecting
    - 5: Failure
    - 6: Listening

    Required parameters:
    - connectionName: Name of the connection

    Returns: Current connection state.`,
    {
      connectionName: z.string().describe("Name of the MQTT connection"),
    },
    async (params: any) => {
      try {
        const result = await mqtt.getConnectionState(params.connectionName);

        if (!result.success) {
          return createErrorResponse(
            `Failed to get connection state: ${result.error}`,
          );
        }

        return createSuccessResponse({
          connectionName: params.connectionName,
          state: result.state,
          stateText: result.stateText,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error getting MQTT connection state:", error);
        return createErrorResponse(
          `Failed to get connection state: ${errorMessage}`,
        );
      }
    },
  );

  // ============================================================================
  // Tool 6: Add MQTT Address to DPE
  // ============================================================================
  server.tool(
    "mqtt-add-address",
    `Configures an MQTT peripheral address for a datapoint element (DPE).

    This tool sets up a DPE to publish and/or subscribe to an MQTT topic.
    The DPE will send/receive values through the specified MQTT connection.

    Required parameters:
    - dpeName: Full datapoint element name (e.g., "MyDevice.Temperature.Value")
    - topic: MQTT topic (e.g., "sensors/temperature")
    - connectionName: Name of the MQTT connection (e.g., "_MqttConnection1")
    - direction: Message direction:
      - 1 = Publish (output) - WinCC OA sends to broker
      - 2 = Subscribe (input) - WinCC OA receives from broker
      - 6 = Both (bidirectional)

    Optional parameters:
    - transformation: Value transformation type:
      - 1001 = Plain string (default)
      - 1002 = JSON Profile: Value only
      - 1003 = JSON Profile: Value & Timestamp
      - 1004 = JSON Profile: Value, Timestamp & Status
    - driverNumber: MQTT driver number (1-99). Auto-detected from connection if not specified.
    - oldNewComparison: Enable old/new value comparison for input (default: true)

    Returns: Success status.`,
    {
      dpeName: z.string().describe("Full datapoint element name (e.g., 'MyDevice.Temperature.Value')"),
      topic: z.string().describe("MQTT topic (e.g., 'sensors/temperature')"),
      connectionName: z.string().describe("Name of the MQTT connection (e.g., '_MqttConnection1')"),
      direction: z
        .number()
        .min(1)
        .max(6)
        .describe("Direction: 1=Publish, 2=Subscribe, 6=Both"),
      transformation: z
        .number()
        .optional()
        .describe("Transformation: 1001=PlainString, 1002=JsonValue, 1003=JsonValueTimestamp, 1004=JsonValueTimestampStatus (default: 1001)"),
      driverNumber: z
        .number()
        .min(1)
        .max(99)
        .optional()
        .describe("MQTT driver number (auto-detected from connection if not specified)"),
      oldNewComparison: z
        .boolean()
        .optional()
        .describe("Enable old/new value comparison for input (default: true)"),
    },
    async (params: any) => {
      try {
        console.log("Configuring MQTT address:", params);
        console.log("  DEBUG - transformation param:", params.transformation, "type:", typeof params.transformation);

        await mqtt.addAddressConfig({
          dpeName: params.dpeName,
          topic: params.topic,
          connectionName: params.connectionName,
          direction: params.direction,
          transformation: params.transformation,
          driverNumber: params.driverNumber,
          oldNewComparison: params.oldNewComparison,
        });

        return createSuccessResponse({
          dpeName: params.dpeName,
          topic: params.topic,
          connectionName: params.connectionName,
          direction: params.direction,
          message: "MQTT address configured successfully",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error configuring MQTT address:", error);
        return createErrorResponse(
          `Failed to configure MQTT address: ${errorMessage}`,
        );
      }
    },
  );

  return 6;
}
