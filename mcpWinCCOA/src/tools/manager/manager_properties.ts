/**
 * Manager Properties Tool
 *
 * MCP tools for getting and updating manager properties in WinCC OA Pmon configuration.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { PmonClient } from '../../helpers/pmon/PmonClient.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register manager properties tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  server.tool(
    "get-manager-properties",
    `Get the configuration properties of a specific manager.

This tool retrieves the current configuration for a manager:
- Start mode (manual, once, always)
- secKill: Seconds to wait before SIGKILL after SIGTERM
- restartCount: Number of restart attempts on crash
- resetMin: Minutes to reset the restart counter
- commandlineOptions: Command line arguments passed to the manager

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- Use this to inspect current configuration before updating
- Properties can be modified using 'update-manager-properties'

Parameters:
- managerIndex: Position of the manager (1-100)

Example:
- Get properties of manager at position 5: managerIndex=5`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager (1-100)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Getting properties for manager at index ${managerIndex}...`);

        const pmonClient = new PmonClient();

        // Get manager name for better feedback
        let managerName = `index ${managerIndex}`;
        try {
          const managerList = await pmonClient.getManagerList();
          if (managerList[managerIndex]) {
            managerName = `'${managerList[managerIndex].manager}' at index ${managerIndex}`;
          }
        } catch (error) {
          // Ignore errors in getting name
        }

        const properties = await pmonClient.getManagerProperties(managerIndex);

        const response = {
          managerIndex,
          managerName,
          properties: {
            startMode: properties.startMode,
            secKill: properties.secKill,
            restartCount: properties.restartCount,
            resetMin: properties.resetMin,
            commandlineOptions: properties.commandlineOptions || ''
          }
        };

        console.log(`Successfully retrieved properties for manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Properties for manager ${managerName} retrieved successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting manager properties:', errorMessage);
        return createErrorResponse(
          `Failed to get manager properties: ${errorMessage}`,
          { code: 'PMON_PROP_GET_ERROR' }
        );
      }
    }
  );

  server.tool(
    "update-manager-properties",
    `Update the configuration properties of a specific manager.

This tool updates the configuration for a manager without stopping or removing it.
The changes will be written to the progs file and take effect on next manager start.

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- Changes take effect on next manager start (restart if currently running)
- All parameters must be provided (get current values first if needed)
- Manager name cannot be changed (use remove + add for that)

Parameters:
- managerIndex: Position of the manager (1-100)
- startMode: When to start the manager (manual, once, always)
  - manual: Must be started manually via console
  - once: Starts only when project starts (not after crash)
  - always: Starts automatically and restarts on crash
- secKill: Seconds to wait before SIGKILL after SIGTERM (default: 30)
- restartCount: Number of restart attempts on crash (default: 3)
- resetMin: Minutes to reset restart counter (default: 5)
- options: Command line options (default: '')

Example:
- Update manager 5 to always restart: managerIndex=5, startMode="always", secKill=30, restartCount=3, resetMin=5, options="-f script.ctl"`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager to update (1-100)"),
      startMode: z.enum(['manual', 'once', 'always']).describe("Start mode: manual, once, or always"),
      secKill: z.number().min(1).describe("Seconds to wait before SIGKILL"),
      restartCount: z.number().min(1).describe("Number of restart attempts"),
      resetMin: z.number().min(1).describe("Minutes to reset restart counter"),
      options: z.string().optional().default('').describe("Command line options for the manager")
    },
    async ({ managerIndex, startMode, secKill, restartCount, resetMin, options }: {
      managerIndex: number;
      startMode: 'manual' | 'once' | 'always';
      secKill: number;
      restartCount: number;
      resetMin: number;
      options?: string;
    }) => {
      try {
        console.log(`Updating properties for manager at index ${managerIndex}...`);

        const pmonClient = new PmonClient();

        // Get manager name for better feedback
        let managerName = `index ${managerIndex}`;
        try {
          const managerList = await pmonClient.getManagerList();
          if (managerList[managerIndex]) {
            managerName = `'${managerList[managerIndex].manager}' at index ${managerIndex}`;
          }
        } catch (error) {
          // Ignore errors in getting name
        }

        const result = await pmonClient.updateManagerProperties(
          managerIndex,
          startMode,
          secKill,
          restartCount,
          resetMin,
          options || ''
        );

        if (!result.success) {
          return createErrorResponse(
            `Failed to update manager properties at index ${managerIndex}: ${result.error}`,
            { code: 'PMON_PROP_PUT_ERROR', details: result.error }
          );
        }

        const response = {
          managerIndex,
          managerName,
          properties: {
            startMode,
            secKill,
            restartCount,
            resetMin,
            options: options || ''
          },
          message: result.data
        };

        console.log(`Successfully updated properties for manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Properties for manager ${managerName} updated successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error updating manager properties:', errorMessage);
        return createErrorResponse(
          `Failed to update manager properties: ${errorMessage}`,
          { code: 'PMON_PROP_PUT_ERROR' }
        );
      }
    }
  );

  return 2; // Number of tools registered
}
