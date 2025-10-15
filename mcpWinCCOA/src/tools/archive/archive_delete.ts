/**
 * Archive Delete Tool
 *
 * MCP tool for deleting archive configurations from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Check if an archive configuration exists
 */
async function hasArchiveConfig(winccoa: any, dpe: string): Promise<boolean> {
  try {
    const archiveType = await winccoa.dpGet(`${dpe}:_archive.._type`);
    return archiveType !== DpConfigType.DPCONFIG_NONE && archiveType !== null && archiveType !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Register archive delete tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "archive-delete",
    `Delete archive configuration from a datapoint element in WinCC OA.

    This tool removes the archive configuration from the specified datapoint element.

    Example:
    {
      "dpe": "System1:Temperature."
    }

    CAUTION: This permanently removes archive configurations. Historical data collection will stop for this element.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Deleting Archive Configuration');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Check if archive configuration exists
        const hasConfig = await hasArchiveConfig(winccoa, dpe);
        if (!hasConfig) {
          return createErrorResponse(
            `No archive configuration exists for ${dpe}`
          );
        }

        // Delete the configuration by setting type to NONE
        console.log(`Deleting archive configuration for ${dpe}`);
        await winccoa.dpSetWait(`${dpe}:_archive.._type`, DpConfigType.DPCONFIG_NONE);

        console.log('========================================');
        console.log('✓ Archive Configuration Deleted');
        console.log('========================================');

        return createSuccessResponse({
          dpe: dpe,
          message: 'Archive configuration deleted successfully'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Archive Deletion Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to delete archive configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
