/**
 * Datapoint Creation Tools
 *
 * MCP tools for creating datapoints.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Datapoint creation request
 */
interface CreateDatapointRequest {
  dpeName: string;
  dpType: string;
  systemId?: number;
  dpId?: number;
}

/**
 * Register datapoint creation tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context with winccoa instance
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "create-datapoint",
    `Create a new datapoint in the WinCC OA system.

dpeName: Name of the datapoint to be created (required)
dpType: Type of datapoint to be created (required)
systemId: System ID for distributed systems (optional)
dpId: Specific datapoint ID (optional, random if not provided)

Returns: Success confirmation with datapoint details or error message.

Throws WinccoaError if:
- Invalid argument types
- Invalid dpeName or dpType
- Non-existing systemId
- Datapoint with given name already exists`,
    {
      dpeName: z.string().min(1, "dpeName must be a non-empty string"),
      dpType: z.string().min(1, "dpType must be a non-empty string"),
      systemId: z.number().min(0).optional(),
      dpId: z.number().min(0).optional()
    },
    async ({ dpeName, dpType, systemId, dpId }: CreateDatapointRequest) => {
      try {
        console.log(`Creating datapoint '${dpeName}' of type '${dpType}'`);

        // Check if winccoa instance is available
        if (!winccoa) {
          throw new Error('WinCC OA connection not available');
        }

        // Call dpCreate with appropriate parameters
        let result: boolean;
        if (systemId !== undefined && dpId !== undefined) {
          result = await winccoa.dpCreate(dpeName, dpType, systemId, dpId);
        } else if (systemId !== undefined) {
          result = await winccoa.dpCreate(dpeName, dpType, systemId);
        } else if (dpId !== undefined) {
          result = await winccoa.dpCreate(dpeName, dpType, undefined, dpId);
        } else {
          result = await winccoa.dpCreate(dpeName, dpType);
        }

        if (result) {
          const successMessage = `Successfully created datapoint '${dpeName}' of type '${dpType}'${
            systemId ? ` on system ${systemId}` : ''
          }${dpId ? ` with ID ${dpId}` : ''}`;
          console.log(successMessage);
          return createSuccessResponse({
            success: true,
            dpeName,
            dpType,
            systemId,
            dpId,
            message: successMessage
          });
        } else {
          const errorMessage = `Failed to create datapoint '${dpeName}' of type '${dpType}'`;
          console.error(errorMessage);
          return createErrorResponse(errorMessage);
        }
      } catch (error) {
        const err = error as Error;
        console.error(`Error creating datapoint '${dpeName}':`, error);

        // Handle specific WinCC OA errors
        let errorMessage = `Error creating datapoint '${dpeName}': ${err.message}`;
        let errorType = 'UNKNOWN_ERROR';

        if (err.message.includes('already exist')) {
          errorMessage = `Datapoint '${dpeName}' already exists`;
          errorType = 'DP_ALREADY_EXISTS';
        } else if (err.message.includes('invalid dpeName')) {
          errorMessage = `Invalid datapoint name '${dpeName}'`;
          errorType = 'INVALID_DP_NAME';
        } else if (err.message.includes('invalid dpType')) {
          errorMessage = `Invalid datapoint type '${dpType}'`;
          errorType = 'INVALID_DP_TYPE';
        } else if (err.message.includes('non-existing systemId')) {
          errorMessage = `System ID ${systemId} does not exist`;
          errorType = 'INVALID_SYSTEM_ID';
        }

        return createErrorResponse(errorMessage, {
          errorCode: (err as any).code || undefined,
          errorType,
          dpeName,
          dpType,
          systemId,
          dpId,
          details: err.message
        });
      }
    }
  );

  return 1; // Number of tools registered
}
