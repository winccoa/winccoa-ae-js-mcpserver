/**
 * PV Range Delete Tool
 *
 * MCP tool for deleting pv_range configurations from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Check if a pv_range configuration exists
 */
async function hasRangeConfig(winccoa: any, dpe: string): Promise<boolean> {
  try {
    const rangeType = await winccoa.dpGet(`${dpe}:_pv_range.._type`);
    return rangeType !== DpConfigType.DPCONFIG_NONE && rangeType !== null && rangeType !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Register pv_range delete tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "pv-range-delete",
    `Delete pv_range (min/max) configuration from a datapoint element in WinCC OA.

    This tool removes the pv_range configuration from the specified datapoint element.

    Example:
    {
      "dpe": "System1:Temperature."
    }

    CAUTION: This permanently removes range configurations. Value validation will no longer be enforced for this element.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Deleting PV Range Configuration');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Check if range configuration exists
        const hasConfig = await hasRangeConfig(winccoa, dpe);
        if (!hasConfig) {
          return createErrorResponse(
            `No pv_range configuration exists for ${dpe}`
          );
        }

        // Delete the configuration by setting type to NONE
        console.log(`Deleting pv_range configuration for ${dpe}`);
        await winccoa.dpSetWait(`${dpe}:_pv_range.._type`, DpConfigType.DPCONFIG_NONE);

        console.log('========================================');
        console.log('✓ PV Range Configuration Deleted');
        console.log('========================================');

        return createSuccessResponse({
          dpe: dpe,
          message: 'PV Range configuration deleted successfully'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ PV Range Deletion Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to delete pv_range configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
