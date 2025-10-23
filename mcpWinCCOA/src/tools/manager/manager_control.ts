/**
 * Manager Control Tools
 *
 * MCP tools for starting, stopping, and controlling WinCC OA managers.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { PmonClient } from '../../helpers/pmon/PmonClient.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register manager control tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  server.tool(
    "start-manager",
    `Start a WinCC OA manager.

This tool starts a manager at the specified index position.
The manager must be configured in the Pmon and currently stopped.

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- The manager must exist in the Pmon configuration
- The manager must be in stopped state
- Data Manager should be started before other managers
- Some managers depend on others (e.g., most managers need Data and Event managers running)

Parameters:
- managerIndex: Position of the manager to start (1-100)

Example:
- Start manager at position 5: managerIndex=5`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager to start (1-100)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Starting manager at index ${managerIndex}...`);

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

        const result = await pmonClient.startManager(managerIndex);

        if (!result.success) {
          return createErrorResponse(
            `Failed to start manager at index ${managerIndex}: ${result.error}`,
            { code: 'PMON_START_ERROR', details: result.error }
          );
        }

        const response = {
          managerIndex,
          message: result.data
        };

        console.log(`Successfully started manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Manager ${managerName} started successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error starting manager:', errorMessage);
        return createErrorResponse(
          `Failed to start manager: ${errorMessage}`,
          { code: 'PMON_START_ERROR' }
        );
      }
    }
  );

  server.tool(
    "stop-manager",
    `Stop a WinCC OA manager gracefully.

This tool stops a manager by sending SIGTERM signal.
The manager will have time to save data and close connections properly.

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- This sends SIGTERM (graceful shutdown)
- The manager has 'secKill' seconds to stop before SIGKILL is sent
- Stopping critical managers (Data, Event) may affect other managers
- Use 'kill-manager' for immediate forced shutdown (not recommended)

Parameters:
- managerIndex: Position of the manager to stop (1-100)

Example:
- Stop manager at position 5: managerIndex=5`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager to stop (1-100)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Stopping manager at index ${managerIndex}...`);

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

        const result = await pmonClient.stopManager(managerIndex);

        if (!result.success) {
          return createErrorResponse(
            `Failed to stop manager at index ${managerIndex}: ${result.error}`,
            { code: 'PMON_STOP_ERROR', details: result.error }
          );
        }

        const response = {
          managerIndex,
          message: result.data
        };

        console.log(`Successfully stopped manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Manager ${managerName} stopped successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error stopping manager:', errorMessage);
        return createErrorResponse(
          `Failed to stop manager: ${errorMessage}`,
          { code: 'PMON_STOP_ERROR' }
        );
      }
    }
  );

  server.tool(
    "kill-manager",
    `Force kill a WinCC OA manager immediately.

This tool kills a manager by sending SIGKILL signal.
The manager will be terminated immediately without proper shutdown.

WARNING: This is a forced shutdown and should only be used when:
- The manager is not responding to stop command
- The manager is in a blocked state
- Emergency situations requiring immediate termination

IMPORTANT NOTES:
- Manager index starts at 1 (0 is Pmon itself)
- This sends SIGKILL (immediate forced termination)
- Data may be lost if not saved
- Connections will not be closed properly
- Prefer 'stop-manager' for graceful shutdown

Parameters:
- managerIndex: Position of the manager to kill (1-100)

Example:
- Kill blocked manager at position 5: managerIndex=5`,
    {
      managerIndex: z.number().min(1).max(100).describe("Index of the manager to kill (1-100)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Killing manager at index ${managerIndex}...`);

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

        const result = await pmonClient.killManager(managerIndex);

        if (!result.success) {
          return createErrorResponse(
            `Failed to kill manager at index ${managerIndex}: ${result.error}`,
            { code: 'PMON_KILL_ERROR', details: result.error }
          );
        }

        const response = {
          managerIndex,
          message: result.data
        };

        console.log(`Successfully killed manager ${managerName}`);
        return createSuccessResponse(
          response,
          `Manager ${managerName} killed successfully`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error killing manager:', errorMessage);
        return createErrorResponse(
          `Failed to kill manager: ${errorMessage}`,
          { code: 'PMON_KILL_ERROR' }
        );
      }
    }
  );

  return 3; // Number of tools registered
}
