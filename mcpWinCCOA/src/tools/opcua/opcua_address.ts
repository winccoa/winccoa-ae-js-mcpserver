/**
 * OPC UA Address Configuration Tool
 *
 * MCP tool for configuring OPC UA address settings on datapoint elements.
 */

import { z } from 'zod';
import OpcUaConnection from '../../helpers/drivers/OpcUaConnection.js';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';
import { OpcUaDatatype, DpAddressDirection } from '../../types/index.js';

/**
 * Register OPC UA Address Configuration tool
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const opcua = new OpcUaConnection();

  server.tool(
    "opcua-add-address-config",
    `Configures OPC UA address settings for a datapoint element.

    This tool sets up both the peripheral address (_address) and distribution (_distrib) configurations
    for a datapoint element, connecting it to an OPC UA server variable through an existing connection.

    Required parameters:
    - dpName: Full datapoint element name (e.g., 'MyDP.Value')
    - connectionName: Name of the OPC UA connection (e.g., '_OpcUAConnection1' or 'OpcUAConnection1')
    - reference: OPC UA node ID (e.g., 'ns=2;s=MyVariable' or 'ns=0;i=2258')

    Optional parameters:
    - datatype: OPC UA datatype transformation (default: 750 = automatic detection)
      Available types: 750-768 (DEFAULT, BOOLEAN, SBYTE, BYTE, INT16, UINT16, INT32, UINT32,
      INT64, UINT64, FLOAT, DOUBLE, STRING, DATETIME, GUID, BYTESTRING, XMLELEMENT, NODEID, LOCALIZEDTEXT)
    - direction: Address direction mode (default: 4 = INPUT_POLL for polled input)
      Common modes: 1=OUTPUT, 2=INPUT_SPONT, 3=INPUT_SQUERY, 4=INPUT_POLL, 5=OUTPUT_SINGLE,
      6=IO_SPONT, 7=IO_POLL, 14=INPUT_SPONT_ON_USE
    - active: Enable address immediately (default: true)
    - managerNumber: OPC UA manager number (1-255). If not specified, automatically detected from connection.
    - subscription: Poll group name (default: 'DefaultPollingFast' with 1000ms interval). Created automatically if not exists as _PollGroup type.

    The tool automatically:
    - Validates all parameters
    - Auto-detects the manager number from the connection if not provided
    - Creates poll group (_PollGroup) if it doesn't exist
    - Builds proper reference string format
    - Sets both _address and _distrib configurations atomically with all required fields (_datatype, _subindex, _poll_group, etc.)
    - Activates the address if requested

    Returns: Success status with configuration details.`,
    {
      dpName: z.string().describe('Full datapoint element name (e.g., "MyDP.Value")'),
      connectionName: z.string().describe('Name of the OPC UA connection'),
      reference: z.string().describe('OPC UA node ID (e.g., "ns=2;s=MyVariable")'),
      datatype: z
        .number()
        .min(750)
        .max(768)
        .optional()
        .describe('OPC UA datatype (750-768, default: 750=automatic)'),
      direction: z
        .number()
        .min(0)
        .max(15)
        .optional()
        .describe('Address direction mode (0-15, default: 4=INPUT_POLL)'),
      active: z.boolean().optional().describe('Enable address immediately (default: true)'),
      managerNumber: z
        .number()
        .min(1)
        .max(255)
        .optional()
        .describe('OPC UA manager number (1-255, auto-detected if not specified)'),
      subscription: z
        .string()
        .optional()
        .describe('Poll group name (default: "DefaultPollingFast" with 1000ms interval, auto-created as _PollGroup if not exists)')
    },
    async (params: any) => {
      try {
        console.log('Configuring OPC UA address:', params);

        // Set defaults
        const datatype = params.datatype ?? OpcUaDatatype.DEFAULT;
        const direction = params.direction ?? DpAddressDirection.DPATTR_ADDR_MODE_INPUT_POLL;
        const active = params.active ?? true;
        const subscription = params.subscription ?? 'DefaultPollingFast';

        // Call the addAddressConfig method
        const success = await opcua.addAddressConfig(
          params.dpName,
          params.connectionName,
          params.reference,
          datatype,
          direction,
          active,
          params.managerNumber,
          subscription
        );

        if (success) {
          console.log(`Successfully configured address for ${params.dpName}`);
          return createSuccessResponse({
            dpName: params.dpName,
            connectionName: params.connectionName,
            reference: params.reference,
            datatype,
            direction,
            active,
            managerNumber: params.managerNumber ?? 'auto-detected',
            subscription,
            message: 'OPC UA address configuration completed successfully'
          });
        } else {
          return createErrorResponse('Failed to configure OPC UA address', {
            dpName: params.dpName,
            connectionName: params.connectionName
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error configuring OPC UA address:', error);
        return createErrorResponse(`Failed to configure OPC UA address: ${errorMessage}`, {
          dpName: params.dpName,
          details: errorMessage,
          stack: errorStack
        });
      }
    }
  );

  return 1; // Number of tools registered
}
