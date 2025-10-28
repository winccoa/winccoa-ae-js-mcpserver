/**
 * Manager Remove Tool
 *
 * MCP tool for removing managers from WinCC OA Pmon configuration.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { PmonClient } from '../../helpers/pmon/PmonClient.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register manager remove tool with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  server.tool(
    "remove-manager",
    `Remove a manager from the WinCC OA Pmon configuration.

This tool removes a manager from the progs file at the specified position.
The manager will be deleted from the startup sequence.

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself, cannot be removed)
- Managers can only be removed if they and all following managers are stopped
- The Data Manager (usually at index 1) should not be removed
- Removing a manager does not stop it if it's currently running - stop it first

Parameters:
- managerIndex: Position of the manager to remove (1-100)

Example:
- Remove manager at position 5: managerIndex=5`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager to remove (1-100, cannot remove Pmon at 0)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Removing manager at index ${managerIndex}...`);

        const pmonClient = new PmonClient();

        // First, get the manager name for better feedback
        let managerName = `index ${managerIndex}`;
        try {
          const status = await pmonClient.getManagerStatus();
          const manager = status.managers.find(m => m.index === managerIndex);
          if (manager) {
            const managerList = await pmonClient.getManagerList();
            const managerInfo = managerList.find((m, idx) => idx === managerIndex);
            if (managerInfo) {
              managerName = `'${managerInfo.manager}' at index ${managerIndex}`;
            }
          }
        } catch (error) {
          // Ignore errors in getting name, will use index only
        }

        const result = await pmonClient.removeManager(managerIndex);

        if (!result.success) {
          return createErrorResponse(
            `Failed to remove manager at index ${managerIndex}: ${result.error}`,
            { code: 'PMON_REMOVE_ERROR', details: result.error }
          );
        }

        const response = {
          managerIndex,
          message: result.data
        };

        console.log(`Successfully removed manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Manager ${managerName} removed successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error removing manager:', errorMessage);
        return createErrorResponse(
          `Failed to remove manager: ${errorMessage}`,
          { code: 'PMON_REMOVE_ERROR' }
        );
      }
    }
  );

  return 1; // Number of tools registered
}
