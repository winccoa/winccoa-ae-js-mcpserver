/**
 * S7Plus Address Configuration Tool
 *
 * MCP tool for configuring S7Plus peripheral addresses on datapoint elements.
 */

import { z } from "zod";
import {
  S7PlusConnection,
} from "../../helpers/drivers/S7PlusConnection.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../utils/helpers.js";
import type { ServerContext } from "../../types/index.js";

/**
 * Map mode string to S7Plus direction number.
 * S7Plus uses direction 7 (IOPoll) for both Polling and Subscription.
 * The difference is determined by poll group + _S7PlusConfig registration, not direction.
 */
const MODE_TO_DIRECTION: Record<string, number> = {
  Polling: 7,
  Subscription: 7,
  Output: 1,
  SingleRead: 3,
  InputPoll: 4,
  SingleWrite: 5,
  IOSingleQuery: 8,
};

/**
 * Register S7Plus Address tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const s7plus = new S7PlusConnection(context.winccoa);

  // ============================================================================
  // Tool 1: Add S7Plus Address to DPE
  // ============================================================================
  server.tool(
    "s7plus-add-address-config",
    `Configures an S7Plus peripheral address for a datapoint element (DPE).

    This tool maps a DPE to a symbolic PLC variable in a Siemens S7-1200/1500 PLC.
    The S7Plus driver uses exclusively symbolic addressing (no absolute/numeric addresses).

    Address Reference Format:
    - Data variables: <Symbolic Address>[:length]
      Examples: MyDB.MyVar, MyDB.MyArray[3], MyDB.MyString:50
    - Alarm variables: <Symbolic Address>:[associated value]:[additional text]

    Required parameters:
    - dpeName: Full datapoint element name (e.g., "MyDevice.Temperature.Value")
    - reference: Symbolic PLC address (e.g., 'MyDB.MyVar')
    - mode: Communication mode:
      - "Polling" = Bidirectional cyclic read/write (uses poll group for timing)
      - "Subscription" = Bidirectional event-based (PLC reports changes, registered in _S7PlusConfig)
      - "Output" = Write-only to PLC
      - "SingleRead" = One-time read from PLC
      - "InputPoll" = Read-only cyclic (input only, no write)
      - "SingleWrite" = One-time write to PLC
      - "IOSingleQuery" = Bidirectional on-demand read/write
    - driverNumber: S7Plus driver number (1-99). Must match the driver assigned to the target connection.
    - connectionName: S7Plus connection datapoint name (e.g., 'myS7PlusConn').

    Optional parameters:
    - transformation: S7Plus data type transformation (default: 1001 = DEFAULT/auto-detect):
      1001=DEFAULT, 1002=BOOL, 1003=BYTE, 1004=WORD, 1005=DWORD, 1006=LWORD,
      1007=USINT, 1008=UINT, 1009=UDINT, 1010=ULINT,
      1011=SINT, 1012=INT, 1013=DINT, 1014=LINT,
      1015=REAL, 1016=LREAL,
      1017=DATE, 1018=DATETIME, 1019=TIME, 1020=TIME_OF_DAY,
      1021=LDATETIME, 1022=LTIME, 1023=LTOD, 1024=DTL, 1025=S5TIME,
      1026=STRING, 1027=WSTRING
    - oldNewComparison: Enable old/new value comparison for input (default: true)
    - itemLength: Item length for string types (optional)
    - pollGroup: Name of the poll group. Default: "_S7Plus_Poll_1s" (Polling) or "_S7Plus_Subscr" (Subscription).
      Not needed for Output, SingleRead, SingleWrite, IOSingleQuery.
    - pollInterval: Polling interval in ms (default: 1000). Only used when poll group is newly created.
    - onlyChanges: Subscription mode only. Report only value changes (default: true).

    Returns: Success status.`,
    {
      dpeName: z.string().describe("Full datapoint element name (e.g., 'MyDevice.Temperature.Value')"),
      reference: z.string().describe("Symbolic PLC address (e.g., 'MyDB.MyVar'). Quotes are automatically stripped."),
      mode: z
        .enum(["Polling", "Subscription", "Output", "SingleRead", "InputPoll", "SingleWrite", "IOSingleQuery"])
        .describe("Communication mode: Polling (cyclic read/write), Subscription (event-based), Output (write-only), SingleRead, InputPoll, SingleWrite, IOSingleQuery"),
      driverNumber: z
        .number()
        .min(1)
        .max(99)
        .describe("S7Plus driver number (1-99). Must match the driver assigned to the target connection."),
      connectionName: z
        .string()
        .describe("S7Plus connection datapoint name (e.g., 'myS7PlusConn'). Sets _address.._connection."),
      transformation: z
        .number()
        .min(1001)
        .max(1027)
        .optional()
        .describe("S7Plus transformation type (default: 1001=DEFAULT). Range: 1001-1027."),
      oldNewComparison: z
        .boolean()
        .optional()
        .describe("Enable old/new value comparison for input (default: true)"),
      itemLength: z
        .number()
        .positive()
        .optional()
        .describe("Item length for string types (optional)"),
      pollGroup: z
        .string()
        .optional()
        .describe("Poll group name. Default: '_S7Plus_Poll_1s' (Polling) or '_S7Plus_Subscr' (Subscription)."),
      pollInterval: z
        .number()
        .positive()
        .optional()
        .describe("Poll interval in ms (default: 1000). Only used when poll group is newly created."),
      onlyChanges: z
        .boolean()
        .optional()
        .describe("Subscription mode only: report only value changes (default: true)."),
    },
    async (params: any) => {
      try {
        console.log("Configuring S7Plus address:", params);

        const direction = MODE_TO_DIRECTION[params.mode];
        if (direction === undefined) {
          return createErrorResponse(`Unknown mode: ${params.mode}`);
        }

        // For Subscription mode, set onlyChanges to activate subscription registration
        const onlyChanges = params.mode === 'Subscription'
          ? (params.onlyChanges ?? true)
          : params.onlyChanges;

        await s7plus.addAddressConfig({
          dpeName: params.dpeName,
          reference: params.reference,
          direction,
          driverNumber: params.driverNumber,
          connectionName: params.connectionName,
          transformation: params.transformation,
          oldNewComparison: params.oldNewComparison,
          itemLength: params.itemLength,
          pollGroup: params.pollGroup,
          pollInterval: params.pollInterval,
          onlyChanges,
        });

        return createSuccessResponse({
          dpeName: params.dpeName,
          reference: params.reference,
          mode: params.mode,
          direction,
          driverNumber: params.driverNumber,
          transformation: params.transformation ?? "DEFAULT (1001)",
          ...(params.pollGroup ? { pollGroup: params.pollGroup } : {}),
          ...(params.pollInterval ? { pollInterval: `${params.pollInterval}ms` } : {}),
          message: "S7Plus address configured successfully",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error configuring S7Plus address:", error);
        return createErrorResponse(
          `Failed to configure S7Plus address: ${errorMessage}`,
        );
      }
    },
  );

  return 1;
}
