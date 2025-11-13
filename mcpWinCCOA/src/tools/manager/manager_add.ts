/**
 * Manager Add Tool
 *
 * MCP tool for adding managers to WinCC OA Pmon configuration.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { PmonClient } from '../../helpers/pmon/PmonClient.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register manager add tool with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  server.tool(
    "add-manager",
    `Add a new manager to the WinCC OA Pmon configuration.

This tool adds a manager at the specified position in the startup sequence.
The manager will be added to the progs file and can be started afterwards.

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- Managers can only be added if the target position and all following managers are stopped
- Maximum 100 managers can be configured
- Data Manager must always be started first (usually at index 1)
- Manager names should be specified without .exe extension (e.g., WCCOActrl, not WCCOActrl.exe)

Parameters:
- managerName: Name of the manager (e.g., WCCOActrl, WCCOAui, WCCOAvalarch)
- position: Position in the startup sequence (1-100)
- startMode: When to start the manager (manual, once, always)
  - manual: Must be started manually via console
  - once: Starts only when project starts (not after crash)
  - always: Starts automatically and restarts on crash (default for most managers)
- options: Command line options (e.g., "-f script.ctl", "-num 2")
- secKill: Seconds to wait before SIGKILL (default: 30)
- restartCount: Number of restart attempts (default: 3)
- resetMin: Minutes to reset restart counter (default: 5)

Examples:
- Add CTRL manager: managerName="WCCOActrl", position=5, startMode="always", options="-f myScript.ctl"
- Add UI manager: managerName="WCCOAui", position=10, startMode="once", options="-p panels/main.pnl"
- Add Archive: managerName="WCCOAvalarch", position=3, startMode="always", options="-num 1"`,
    {
      managerName: z.string().min(1).describe("Manager name without .exe extension"),
      position: z.number().min(1).max(100).describe("Position in startup sequence (1-100)"),
      startMode: z.enum(['manual', 'once', 'always']).default('always').describe("Start mode: manual, once, or always"),
      options: z.string().optional().default('').describe("Command line options for the manager"),
      secKill: z.number().min(1).optional().default(30).describe("Seconds to wait before SIGKILL (default: 30)"),
      restartCount: z.number().min(1).optional().default(3).describe("Number of restart attempts (default: 3)"),
      resetMin: z.number().min(1).optional().default(5).describe("Minutes to reset restart counter (default: 5)")
    },
    async ({ managerName, position, startMode, options, secKill, restartCount, resetMin }: {
      managerName: string;
      position: number;
      startMode: 'manual' | 'once' | 'always';
      options?: string;
      secKill?: number;
      restartCount?: number;
      resetMin?: number;
    }) => {
      try {
        console.log(`Adding manager '${managerName}' at position ${position} with start mode '${startMode}'...`);

        // Validate manager name
        const cleanManagerName = managerName.trim();
        if (!cleanManagerName) {
          return createErrorResponse(
            'Manager name cannot be empty',
            { code: 'INVALID_MANAGER_NAME' }
          );
        }

        // Remove .exe extension if present
        const normalizedManagerName = cleanManagerName.replace(/\.exe$/i, '');

        const pmonClient = new PmonClient();
        const result = await pmonClient.addManager(
          position,
          normalizedManagerName,
          startMode,
          secKill!,
          restartCount!,
          resetMin!,
          options!
        );

        if (!result.success) {
          return createErrorResponse(
            `Failed to add manager: ${result.error}`,
            { code: 'PMON_ADD_ERROR', details: result.error }
          );
        }

        const response = {
          managerName: normalizedManagerName,
          position,
          startMode,
          secKill,
          restartCount,
          resetMin,
          options,
          message: result.data
        };

        console.log(`Successfully added manager '${normalizedManagerName}' at position ${position}`);
        return createSuccessResponse(
          response,
          `Manager '${normalizedManagerName}' added successfully at position ${position}`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error adding manager:', errorMessage);
        return createErrorResponse(
          `Failed to add manager: ${errorMessage}`,
          { code: 'PMON_ADD_ERROR' }
        );
      }
    }
  );

  return 1; // Number of tools registered
}
