/**
 * PV Range Query Tool
 *
 * MCP tool for querying existing pv_range configurations from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Query range configuration for a datapoint element
 */
async function queryRangeConfig(winccoa: any, dpe: string): Promise<any> {
  try {
    // Read all range configuration parameters
    const [configType, minValue, maxValue, includeMin, includeMax] = await Promise.all([
      winccoa.dpGet(`${dpe}:_pv_range.._type`),
      winccoa.dpGet(`${dpe}:_pv_range.._min`),
      winccoa.dpGet(`${dpe}:_pv_range.._max`),
      winccoa.dpGet(`${dpe}:_pv_range.._incl_min`),
      winccoa.dpGet(`${dpe}:_pv_range.._incl_max`)
    ]);

    // Check if configuration exists
    if (configType === DpConfigType.DPCONFIG_NONE || configType === null || configType === undefined) {
      return null;
    }

    return {
      type: configType,
      min: minValue,
      max: maxValue,
      includeMin: includeMin,
      includeMax: includeMax,
      configured: true
    };
  } catch (error) {
    console.error(`Error querying range config for ${dpe}:`, error);
    return null;
  }
}

/**
 * Register pv_range query tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "pv-range-query",
    `Query existing pv_range (min/max) configuration from a datapoint element in WinCC OA.

    Returns the current range configuration including min, max values and whether boundaries are inclusive.

    Example:
    {
      "dpe": "System1:Temperature."
    }

    Returns:
    - type: Configuration type constant
    - min: Minimum value
    - max: Maximum value
    - includeMin: Whether minimum is included in valid range
    - includeMax: Whether maximum is included in valid range
    - configured: true if a configuration exists

    Returns null if no pv_range configuration exists.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Querying PV Range Configuration');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Query the range configuration
        const rangeConfig = await queryRangeConfig(winccoa, dpe);

        if (!rangeConfig) {
          console.log('No pv_range configuration found');
          console.log('========================================');
          return createSuccessResponse({
            dpe: dpe,
            configured: false,
            message: 'No pv_range configuration exists for this datapoint element'
          });
        }

        console.log(`Configuration Type: ${rangeConfig.type}`);
        console.log(`Min: ${rangeConfig.min} (${rangeConfig.includeMin ? 'inclusive' : 'exclusive'})`);
        console.log(`Max: ${rangeConfig.max} (${rangeConfig.includeMax ? 'inclusive' : 'exclusive'})`);
        console.log('========================================');
        console.log('✓ PV Range Query Complete');
        console.log('========================================');

        return createSuccessResponse({
          dpe: dpe,
          ...rangeConfig
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ PV Range Query Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to query pv_range configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
