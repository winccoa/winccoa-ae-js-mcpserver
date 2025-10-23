/**
 * Common Config Query Tool
 *
 * MCP tool for querying existing common config attributes from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Query common config attributes for a datapoint element
 */
async function queryCommonConfig(winccoa: any, dpe: string): Promise<any> {
  try {
    // Read all common config attributes
    const description = winccoa.dpGetDescription(dpe);
    const alias = winccoa.dpGetAlias(dpe);
    const format = winccoa.dpGetFormat(dpe);
    const unit = winccoa.dpGetUnit(dpe);

    // Build result object with only non-empty attributes
    const result: any = {
      dpe: dpe,
      configured: false
    };

    // Check if any attribute exists (not empty/null/undefined)
    let hasConfig = false;

    if (description && Object.keys(description).length > 0) {
      result.description = description;
      hasConfig = true;
    }

    if (alias && alias.trim() !== '') {
      result.alias = alias;
      hasConfig = true;
    }

    if (format && Object.keys(format).length > 0) {
      result.format = format;
      hasConfig = true;
    }

    if (unit && Object.keys(unit).length > 0) {
      result.unit = unit;
      hasConfig = true;
    }

    result.configured = hasConfig;

    return result;
  } catch (error) {
    console.error(`Error querying common config for ${dpe}:`, error);
    throw error;
  }
}

/**
 * Register common config query tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "common-query",
    `Query existing common config attributes (description, alias, format, unit) from a datapoint element in WinCC OA.

    Returns the current common config attributes. All language strings are UTF-8 encoded.

    Example:
    {
      "dpe": "System1:Temperature."
    }

    Returns:
    - description: Multi-language description (UTF-8 encoded)
    - alias: Alias name (string)
    - format: Multi-language format string (UTF-8 encoded)
    - unit: Multi-language engineering unit (UTF-8 encoded)
    - configured: true if any attribute exists

    Returns only attributes that are set. Omits empty/undefined attributes.
    Returns configured: false if no common config attributes exist.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Querying Common Config');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Query the common config
        const commonConfig = await queryCommonConfig(winccoa, dpe);

        if (!commonConfig.configured) {
          console.log('No common config attributes found');
          console.log('========================================');
          return createSuccessResponse({
            dpe: dpe,
            configured: false,
            message: 'No common config attributes exist for this datapoint element'
          });
        }

        console.log(`Description: ${commonConfig.description ? 'set' : 'not set'}`);
        console.log(`Alias: ${commonConfig.alias || 'not set'}`);
        console.log(`Format: ${commonConfig.format ? 'set' : 'not set'}`);
        console.log(`Unit: ${commonConfig.unit ? 'set' : 'not set'}`);
        console.log('========================================');
        console.log('✓ Common Config Query Complete');
        console.log('========================================');

        return createSuccessResponse(commonConfig);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Common Config Query Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to query common config: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
