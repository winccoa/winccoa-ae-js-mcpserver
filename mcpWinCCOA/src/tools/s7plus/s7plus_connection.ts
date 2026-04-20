/**
 * S7Plus Connection Management Tools
 *
 * MCP tools for creating, deleting, listing, and browsing S7Plus connections.
 */

import { z } from "zod";
import {
  S7PlusConnection,
  S7PlusPlcType,
} from "../../helpers/drivers/S7PlusConnection.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../utils/helpers.js";
import type { ServerContext } from "../../types/index.js";

/**
 * Register S7Plus Connection tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const s7plus = new S7PlusConnection(context.winccoa);

  // ============================================================================
  // Tool 1: Add S7Plus Connection
  // ============================================================================
  server.tool(
    "s7plus-add-connection",
    `Creates and configures a new S7Plus connection datapoint.

    This tool sets up the necessary datapoint structure (_S7PlusConnection) and
    configures its properties based on the provided parameters.

    Required parameters:
    - ipAddress: IP address of the PLC. A TIA export may list multiple IP addresses
      (one per network interface), but only up to 2 can be used: one primary (ipAddress)
      and one optional redundant (reduAddress). Typically X1 is used as the primary address.
    - plcType: Type of PLC: 1=Automatic, 2=R/H, 3=R/H Single, 16=S7-1500, 272=S7-1200, 528=S7-1500 SoftCtrl, 768=PLCSim.
      R/H: Use the System-IP (managed by the PLC itself for failover).
      R/H Single: Use the individual CPU IP address (do NOT use the System-IP).
    - managerNumber: S7Plus driver number (1-99) to assign this connection to.

    Optional parameters:
    - accessPoint: Network access point (e.g., "S7ONLINE"). Use s7plus-browse with mode="AccessPoints" to discover.
    - connType: Connection type: 0=Single, 1=ReduLan (default: 0).
      Use ReduLan for redundant connections (requires reduAddress).
    - password: Password for PLC connection (if required)
    - stationName: Override for Config.StationName. Used for browsing.
      - Online mode: Defaults to 'S7Plus$Online|Online'
      - Offline mode: Constructed from 'tiaExportName' and 'station' params.
    - enableConnection: Enable the connection immediately after creation (default: true)
    - useTls: Use TLS for secure connection (default: false).
      IMPORTANT: TLS requires the matching CA certificate of the PLC in the trust list.
      Before enabling TLS, add the PLC's CA certificate using
      's7plus-manage-ca-certificates' with action 'add'. The client certificate is optional.
      Use action 'list-ca' to check which CA certificates are already trusted.
    - browseMode: 'Online' or 'Offline'. Determines how browsing is handled.
      IMPORTANT: The browse mode is fixed at connection creation time.
      An Online connection can ONLY browse Online, an Offline connection can ONLY browse Offline/Root.
      If you need both, create two separate connections.
    - tiaExportName: Filename of the TIA Portal export (e.g., 'MyProject_Export.zip'). For 'Offline' mode.
    - station: The specific station/PLC name within the TIA export (e.g., 'PLC_1'). Required for 'Offline' mode.

    Offline mode discovery flow:
    1. If 'browseMode' is 'Offline' and 'tiaExportName' is omitted, the tool discovers available TIA exports in the project.
    2. If 'tiaExportName' is provided but 'station' is omitted, the tool discovers available stations/PLCs inside the export.
    3. Once both 'tiaExportName' and 'station' are provided, the connection is created with the correct StationName.

    Returns: Connection details on success, or a list of available exports/stations for discovery.`,
    {
      ipAddress: z.string().ip().describe("IP address of the PLC"),
      plcType: z
        .number()
        .describe("Type of PLC: 1=Automatic, 2=R/H, 3=R/H Single, 16=S7-1500, 272=S7-1200, 528=S7-1500 SoftCtrl, 768=PLCSim"),
      managerNumber: z
        .number()
        .min(1)
        .max(99)
        .describe("S7Plus driver number (1-99) to assign this connection to"),
      accessPoint: z.string().optional().describe('Network access point (e.g., "S7ONLINE").'),
      connType: z.number().optional().describe("Connection type: 0=Single, 1=ReduLan (default: 0)"),
      password: z.string().optional().describe("Password for PLC connection (if required)"),
      stationName: z.string().optional().describe("Override for Config.StationName."),
      enableConnection: z.boolean().optional().describe("Enable the connection immediately (default: true)"),
      useTls: z.boolean().optional().describe("Use TLS for secure connection (default: false)."),
      certificate: z.string().optional().describe("Server certificate file name for TLS verification (from data/s7plus/cert). Optional."),
      browseMode: z.enum(["Online", "Offline"]).optional().describe("Browse mode: 'Online' or 'Offline'."),
      tiaExportName: z.string().optional().describe("Filename of the TIA Portal export for 'Offline' mode."),
      station: z.string().optional().describe("PLC/station name within the TIA export (e.g., 'PLC_1'). Required for Offline mode. Omit to discover available stations."),
      reduAddress: z.string().optional().describe("Redundant IP address (second PLC interface). Required when connType=1 (ReduLan)."),
      reduAccessPoint: z.string().optional().describe("Access point for the redundant connection (defaults to accessPoint)."),
      reduSwitchCondition: z.number().optional().describe("When to switch to redundant connection: 0=Disabled, 1=OnError, 2=TimeSlot, 3=OpState, 4=SwitchTag (default: 0)"),
      reduSwitchTag: z.string().optional().describe("Datapoint name for switch condition when reduSwitchCondition=4 (SwitchTag).")
    },
    async (params: any) => {
      try {
        console.log("Adding S7Plus connection:", params);

        let stationName = params.stationName;
        const browseMode = params.browseMode ?? 'Online';

        if (browseMode === 'Offline' && !params.tiaExportName && !stationName) {
          const answer = await server.question({
            questions: [{
              question: "The TIA Portal export name is missing for offline mode. Do you want to search for available exports in the project?",
              header: "Search for TIA Exports?",
              options: [
                { label: "Yes, search for exports", description: "Creates a temporary connection to find available TIA Portal exports." },
                { label: "No, cancel", description: "Cancels the operation." }
              ]
            }]
          });

          if (!answer || answer[0] === 'No, cancel') {
            return createErrorResponse("Operation cancelled. Please provide a 'tiaExportName' for offline mode.");
          }

          console.log("Creating temporary connection to search for TIA exports...");
          const tempConnResult = await s7plus.addConnection({
            ipAddress: params.ipAddress,
            plcType: params.plcType ?? S7PlusPlcType.S7_1500,
            managerNumber: params.managerNumber,
            enableConnection: false,
          });

          if (!tempConnResult.success || !tempConnResult.connectionName) {
            return createErrorResponse(`Failed to create temporary connection for browsing: ${tempConnResult.error}`);
          }

          console.log(`Browsing for TIA exports on temporary connection ${tempConnResult.connectionName}...`);
          const browseResult = await s7plus.browse(tempConnResult.connectionName, { mode: 'Root' });
          
          await s7plus.deleteConnection(tempConnResult.connectionName);
          console.log(`Temporary connection ${tempConnResult.connectionName} deleted.`);

          if (browseResult.nodes.length === 0) {
            return createErrorResponse("No TIA Portal exports found in the project.");
          }

          return createSuccessResponse({
            message: "Found available TIA Portal exports. Please re-run the command with the desired 'tiaExportName'.",
            availableExports: browseResult.nodes.map(node => node.path),
          });
        }

        if (!stationName) {
          if (browseMode === 'Online') {
            stationName = 'S7Plus$Online|Online';
            console.log(`Browse mode Online → StationName: ${stationName}`);
          } else if (browseMode === 'Offline') {
            if (!params.tiaExportName) {
              return createErrorResponse("tiaExportName is required for 'Offline' mode.");
            }

            // Station is required for a working Offline connection.
            // If missing, discover available stations inside the TIA export.
            if (!params.station) {
              console.log(`Station missing for Offline mode. Discovering stations in TIA export '${params.tiaExportName}'...`);

              const tempConnResult = await s7plus.addConnection({
                ipAddress: params.ipAddress,
                plcType: params.plcType ?? S7PlusPlcType.S7_1500,
                managerNumber: params.managerNumber,
                stationName: params.tiaExportName,
                enableConnection: false,
              });

              if (!tempConnResult.success || !tempConnResult.connectionName) {
                return createErrorResponse(`Failed to create temporary connection for station discovery: ${tempConnResult.error}`);
              }

              try {
                console.log(`Browsing stations in TIA export on temporary connection ${tempConnResult.connectionName}...`);
                const browseResult = await s7plus.browse(tempConnResult.connectionName, { mode: 'Offline' });

                if (browseResult.nodes.length === 0) {
                  return createErrorResponse(
                    `No stations (PLCs) found in TIA export '${params.tiaExportName}'. ` +
                    `Verify the export file is valid and contains at least one PLC station.`
                  );
                }

                return createSuccessResponse({
                  message: `Found stations in TIA export '${params.tiaExportName}'. ` +
                    `Please re-run the command with the desired 'station' parameter.`,
                  tiaExportName: params.tiaExportName,
                  availableStations: browseResult.nodes.map(node => node.path),
                });
              } finally {
                await s7plus.deleteConnection(tempConnResult.connectionName);
                console.log(`Temporary connection ${tempConnResult.connectionName} deleted.`);
              }
            }

            stationName = `${params.tiaExportName}|${params.station}`;
            console.log(`Browse mode Offline → StationName: ${stationName}`);
          }
        }

        const result = await s7plus.addConnection({ ...params, stationName });

        if (!result.success) {
          return createErrorResponse(`Failed to add S7Plus connection: ${result.error}`);
        }
        
        return createSuccessResponse({
          connectionName: result.connectionName,
          message: "S7Plus connection created and configured successfully",
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error adding S7Plus connection:", error);
        return createErrorResponse(`Failed to add S7Plus connection: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 2: Update S7Plus Connection
  // ============================================================================
  server.tool(
    "s7plus-update-connection",
    `Updates settings of an existing S7Plus connection WITHOUT deleting it.
    Only the provided fields are changed - all others remain unchanged.
    This preserves all existing _address configurations on datapoints.

    IMPORTANT: Always use this tool instead of deleting and recreating a connection.
    Deleting a connection destroys all _address configs referencing it.

    All parameters except connectionName are optional - only provide what you want to change.`,
    {
      connectionName: z.string().describe("Name of the S7Plus connection to update"),
      ipAddress: z.string().optional().describe("New IP address of the PLC"),
      plcType: z.number().optional().describe("New PLC type: 1=Automatic, 2=R/H, 3=R/H Single, 16=S7-1500, 272=S7-1200, 528=S7-1500 SoftCtrl, 768=PLCSim"),
      accessPoint: z.string().optional().describe("New network access point"),
      connType: z.number().optional().describe("Connection type: 0=Single, 1=ReduLan"),
      keepAliveTimeout: z.number().optional().describe("Keep alive timeout in seconds"),
      reconnectTimeout: z.number().optional().describe("Reconnect timeout in seconds"),
      useUtc: z.boolean().optional().describe("Use UTC timestamps"),
      timezoneOffset: z.number().optional().describe("Timezone offset in minutes"),
      setInvalidBit: z.boolean().optional().describe("Set invalid bit on connection loss"),
      enableStatistics: z.boolean().optional().describe("Enable statistics"),
      enableDiagnostics: z.boolean().optional().describe("Enable diagnostics"),
      readOpState: z.boolean().optional().describe("Read PLC operating state"),
      timeSyncMode: z.number().optional().describe("Time sync: 0=Inactive, 1=Sync PLC to WinCC OA"),
      timeSyncInterval: z.number().optional().describe("Time sync interval in seconds"),
      stationName: z.string().optional().describe("Station name override"),
      password: z.string().optional().describe("PLC connection password"),
      useTls: z.boolean().optional().describe("Use TLS"),
      certificate: z.string().optional().describe("Server certificate file name for TLS verification (from data/s7plus/cert)"),
      enableConnection: z.boolean().optional().describe("Enable or disable the connection"),
      reduAddress: z.string().optional().describe("Redundant IP address"),
      reduAccessPoint: z.string().optional().describe("Redundant access point"),
      reduSwitchCondition: z.number().optional().describe("Redu switch condition: 0=Disabled, 1=OpState, 2=ConnState, 3=OpState&ConnState, 4=SwitchTag"),
      reduSwitchTag: z.string().optional().describe("Redu switch tag (for SwitchTag condition)"),
    },
    async (params: any) => {
      try {
        const { connectionName, ...updates } = params;
        const result = await s7plus.updateConnection(connectionName, updates);
        if (!result.success) {
          return createErrorResponse(`Failed to update S7Plus connection: ${result.error}`);
        }
        return createSuccessResponse({
          connectionName,
          message: "S7Plus connection updated successfully",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error updating S7Plus connection:", error);
        return createErrorResponse(`Failed to update S7Plus connection: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 3: Delete S7Plus Connection
  // ============================================================================
  server.tool(
    "s7plus-delete-connection",
    `Deletes an S7Plus connection. Disables the connection first, then removes the datapoint.

    WARNING: Deleting a connection DESTROYS all _address configurations on datapoints
    that reference this connection. To change connection settings, use
    's7plus-update-connection' instead - it preserves all _address configs.

    Only delete a connection if you truly want to remove it entirely.`,
    {
      connectionName: z.string().describe("Name of the S7Plus connection to delete"),
    },
    async (params: any) => {
      try {
        const result = await s7plus.deleteConnection(params.connectionName);
        if (!result.success) {
          return createErrorResponse(`Failed to delete S7Plus connection: ${result.error}`);
        }
        return createSuccessResponse({
          connectionName: params.connectionName,
          message: "S7Plus connection deleted successfully",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error deleting S7Plus connection:", error);
        return createErrorResponse(`Failed to delete S7Plus connection: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 3: List S7Plus Connections
  // ============================================================================
  server.tool(
    "s7plus-list-connections",
    `Lists all S7Plus connections with their current state, IP address, and PLC type.`,
    {},
    async () => {
      try {
        const result = await s7plus.listConnections();
        if (!result.success) {
          return createErrorResponse(`Failed to list S7Plus connections: ${result.error}`);
        }
        return createSuccessResponse(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error listing S7Plus connections:", error);
        return createErrorResponse(`Failed to list S7Plus connections: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 4: Get S7Plus Connection State
  // ============================================================================
  server.tool(
    "s7plus-get-connection-state",
    `Gets the current state of an S7Plus connection.
    Returns: Connection state (Inactive/Disconnected/Connecting/Connected/Disconnecting/Failure), PLC type, and IP address.`,
    {
      connectionName: z.string().describe("Name of the S7Plus connection"),
    },
    async (params: any) => {
      try {
        const result = await s7plus.getConnectionState(params.connectionName);
        if (!result.success) {
          return createErrorResponse(`Failed to get connection state: ${result.error}`);
        }
        return createSuccessResponse(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error getting S7Plus connection state:", error);
        return createErrorResponse(`Failed to get connection state: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 5: Browse S7Plus Connection
  // ============================================================================
  server.tool(
    "s7plus-browse",
    `Browses the PLC structure of an S7Plus connection.

    Browse modes:
    - "Online": Browse a live connected PLC (requires Connected state). Lists data blocks, tags, types.
    - "Offline": Browse a TIA Portal export file (no PLC connection needed).
    - "Root": List available TIA Portal exports in the OA project.
    - "AccessPoints": List available network access points (e.g., S7ONLINE).

    IMPORTANT - Browse mode depends on how the connection was created:
    - A connection created with browseMode="Online" can ONLY browse in "Online" mode.
    - A connection created with browseMode="Offline" can ONLY browse in "Offline" and "Root" modes.
    - You CANNOT use Online browsing on an Offline connection or vice versa.
    - "AccessPoints" mode works with any connection.
    If you need both Online and Offline browsing, create two separate connections.

    For Online mode, use 'category' to filter: "All", "Blocks", "Tags", "Types".
    Use 'nodeName' to browse into a specific block, and 'subPath' for deeper levels.

    Supports pagination via 'offset' and 'limit' (max 800 nodes per page).`,
    {
      connectionName: z.string().describe("Name of the S7Plus connection to browse"),
      mode: z.enum(["Online", "Offline", "Root", "AccessPoints"]).optional().describe("Browse mode (default: Root)"),
      category: z.string().optional().describe("Category filter: 'All', 'Blocks', 'Tags', 'Types', 'Alarms' (Online/Offline)"),
      nodeName: z.string().optional().describe("Specific node to browse into (e.g., 'Data_block_2')"),
      subPath: z.string().optional().describe("Deeper path within node, pipe-separated (e.g., 'SubStruct|Member')"),
      station: z.string().optional().describe("Station name for Offline mode (e.g., 'PLC_1')"),
      offset: z.number().optional().describe("Pagination offset (default: 0)"),
      limit: z.number().optional().describe("Max nodes per page (default/max: 800)"),
      hmiFilter: z.string().optional().describe("'1' = only HMI-visible tags, '0' = all (default: '0')"),
      browseLevel: z.string().optional().describe("'1' = one level (default), '0' = recursive"),
    },
    async (params: any) => {
      try {
        const result = await s7plus.browse(params.connectionName, {
          mode: params.mode,
          category: params.category,
          nodeName: params.nodeName,
          subPath: params.subPath,
          station: params.station,
          offset: params.offset,
          limit: params.limit,
          hmiFilter: params.hmiFilter,
          browseLevel: params.browseLevel,
        });
        return createSuccessResponse(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error browsing S7Plus connection:", error);
        return createErrorResponse(`Failed to browse S7Plus connection: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 6: Manage S7Plus CA Certificates (Trust List)
  // ============================================================================
  server.tool(
    "s7plus-manage-ca-certificates",
    `Manages the S7Plus driver CA certificate trust list (_S7PlusConfig.CaCertificates).
    Required for TLS connections.

    IMPORTANT - There are TWO different certificate types in S7Plus:
    - CA certificates (Root/CA certs): Stored in _S7PlusConfig.CaCertificates (this tool).
      These are the ROOT certificates used to verify the PLC's identity.
      At least one matching CA certificate is REQUIRED for TLS.
    - Server certificate: Set via the 'certificate' parameter on s7plus-add-connection
      or s7plus-update-connection (stored in Config.Certificate on the connection DP).
      This is the PLC's server certificate used for verification. Optional.
    Note: There is no client certificate verification - the PLC does not verify the client.
    All certificate files are located in 'data/s7plus/cert'.

    This tool ONLY manages CA certificates (the root trust list), NOT client certificates.

    Actions:
    - "list-ca": List all CA certificates currently in the trust list.
    - "add": Add CA certificate file names to the trust list (skips duplicates).
    - "remove": Remove CA certificate file names from the trust list.

    Certificate file names must match the files in the S7Plus certificate directory
    (default: data/s7plus/cert). The client must provide the correct file names.`,
    {
      action: z.enum(["list-ca", "add", "remove"]).describe("Action: 'list-ca', 'add', or 'remove'"),
      certificates: z.array(z.string()).optional().describe("Certificate file names (required for 'add' and 'remove')"),
    },
    async (params: any) => {
      try {
        if (params.action === 'list-ca') {
          const result = await s7plus.listCaCertificates();
          if (!result.success) {
            return createErrorResponse(result.error ?? 'Failed to list certificates');
          }
          return createSuccessResponse({
            certificates: result.certificates,
            count: result.certificates?.length ?? 0,
          });
        }

        if (!params.certificates || params.certificates.length === 0) {
          return createErrorResponse(`Certificate file names are required for '${params.action}' action`);
        }

        if (params.action === 'add') {
          const result = await s7plus.addCaCertificates(params.certificates);
          if (!result.success) {
            return createErrorResponse(result.error ?? 'Failed to add certificates');
          }
          return createSuccessResponse({
            added: result.added,
            alreadyPresent: result.alreadyPresent,
            message: `Added ${result.added.length} certificate(s), ${result.alreadyPresent.length} already present`,
          });
        }

        if (params.action === 'remove') {
          const result = await s7plus.removeCaCertificates(params.certificates);
          if (!result.success) {
            return createErrorResponse(result.error ?? 'Failed to remove certificates');
          }
          return createSuccessResponse({
            removed: result.removed,
            notFound: result.notFound,
            message: `Removed ${result.removed.length} certificate(s), ${result.notFound.length} not found`,
          });
        }

        return createErrorResponse(`Unknown action: ${params.action}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error managing CA certificates:", error);
        return createErrorResponse(`Failed to manage CA certificates: ${errorMessage}`);
      }
    },
  );

  // ============================================================================
  // Tool 7: Discover TIA Portal Projects
  // ============================================================================
  server.tool(
    "s7plus-discover-tia-projects",
    `Discovers which TIA Portal project exports and PLCs/stations are available in the
    current WinCC OA project (the SCADA project in which this MCP server is running).

    IMPORTANT: This tool MUST be called when the user asks which TIA project is in
    the project, which TIA exports exist, or which PLCs are available. It MUST also
    be called before creating an S7Plus connection with offline browse mode when the
    TIA export name and PLC/station are unknown.

    This tool does NOT browse the file system. It queries the S7Plus driver internally
    to discover TIA Portal exports that have been imported into the WinCC OA project.
    For each export found, it also lists the PLCs/stations contained within it.

    Use the returned export name and station name as parameters for
    's7plus-add-connection' with browseMode='Offline'.

    No parameters required. Uses an existing running S7Plus driver automatically.
    If no S7Plus driver is running, returns an error indicating that a driver must
    be created and started first.

    Returns: List of TIA project exports with their PLCs/stations.`,
    {},
    async () => {
      try {
        const result = await s7plus.discoverTiaProjects();

        if (!result.success) {
          return createErrorResponse(result.error ?? 'Discovery failed');
        }

        return createSuccessResponse({
          tiaProjects: result.tiaProjects,
          message: result.message,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error discovering TIA projects:", error);
        return createErrorResponse(`Failed to discover TIA projects: ${errorMessage}`);
      }
    },
  );

  return 8;
}
