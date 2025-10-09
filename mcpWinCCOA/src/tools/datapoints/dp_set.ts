/**
 * Datapoint Set Tools
 *
 * MCP tools for setting datapoint values.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Datapoint set request (single)
 */
interface DatapointSetRequest {
  dpeName: string;
  value: any;
}

/**
 * Datapoint set result
 */
interface DatapointSetResult {
  [dpeName: string]: {
    success: boolean;
    result?: any;
    error?: string;
  };
}

/**
 * Register datapoint set tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "dp-set",
    `Set value of datapoint element(s) in WinCC OA.

    For a single datapoint: pass as object with dpeName and value
    For multiple datapoints: pass as array of objects with dpeName and value

    Example single: { dpeName: 'System1:Pump.cmd.start', value: true }
    Example multiple: [{ dpeName: 'System1:Pump.cmd.start', value: true }, { dpeName: 'System1:Valve.cmd.open', value: 50 }]

    CAUTION: This operation directly controls real industrial equipment. Use with care in production environments.
    `,
    {
      datapoints: z.union([
        z.object({
          dpeName: z.string(),
          value: z.any()
        }),
        z.array(
          z.object({
            dpeName: z.string(),
            value: z.any()
          })
        ),
        z.string(),
        z.array(z.string())
      ])
    },
    async ({ datapoints }: { datapoints: DatapointSetRequest | DatapointSetRequest[] | string | string[] }) => {
      try {
        // Parse string if needed
        let parsedDatapoints: DatapointSetRequest | DatapointSetRequest[] = datapoints as any;
        if (typeof datapoints === 'string') {
          parsedDatapoints = JSON.parse(datapoints);
        }

        // Ensure array
        const dpArray = Array.isArray(parsedDatapoints) ? parsedDatapoints : [parsedDatapoints];
        const results: DatapointSetResult = {};

        for (const dp of dpArray) {
          try {
            console.log(`🔄 Setting ${dp.dpeName} = ${dp.value}`);
            const result = winccoa.dpSet(dp.dpeName, dp.value);
            results[dp.dpeName] = { success: true, result };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error setting ${dp.dpeName}:`, errorMessage);
            results[dp.dpeName] = { success: false, error: errorMessage };
          }
        }

        return createSuccessResponse(results);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error in dp-set:`, error);
        return createErrorResponse(`Failed to set datapoints: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
