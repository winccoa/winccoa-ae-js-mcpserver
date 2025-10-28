/**
 * Manager List Tools
 *
 * MCP tools for listing WinCC OA managers and their status.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { PmonClient } from '../../helpers/pmon/PmonClient.js';
import type { ServerContext } from '../../types/index.js';
import { ManagerState, ManagerStartMode } from '../../types/pmon/protocol.js';

/**
 * Get human-readable state name
 */
function getStateName(state: ManagerState): string {
  switch (state) {
    case ManagerState.Stopped:
      return 'stopped';
    case ManagerState.Init:
      return 'initializing';
    case ManagerState.Running:
      return 'running';
    case ManagerState.Blocked:
      return 'blocked';
    default:
      return 'unknown';
  }
}

/**
 * Get human-readable start mode name
 */
function getStartModeName(startMode: ManagerStartMode): string {
  switch (startMode) {
    case ManagerStartMode.Manual:
      return 'manual';
    case ManagerStartMode.Once:
      return 'once';
    case ManagerStartMode.Always:
      return 'always';
    default:
      return 'unknown';
  }
}

/**
 * Register manager list tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  server.tool(
    "list-managers",
    `List all WinCC OA managers with their current status.

Returns a list of all managers configured in the Pmon, including:
- Manager index (position in startup sequence)
- Manager name
- Current state (stopped, initializing, running, blocked)
- Process ID (PID)
- Start mode (manual, once, always)
- Start time
- Manager number

Also includes Pmon status information:
- Current Pmon mode
- Emergency mode status
- Demo mode status

Note: Requires Pmon to be running on localhost:4999 (or configured via environment variables).`,
    {
      includeDetails: z.boolean().optional().describe("Include detailed manager configuration (default: false)")
    },
    async ({ includeDetails }: { includeDetails?: boolean }) => {
      try {
        console.log('Listing WinCC OA managers...');

        const pmonClient = new PmonClient();
        const status = await pmonClient.getManagerStatus();

        // Always fetch manager names and details
        let managerDetails = null;
        try {
          managerDetails = await pmonClient.getManagerList();
        } catch (error) {
          console.warn('Could not fetch manager names:', error);
        }

        // Format response
        const managers = status.managers.map((mgr, idx) => {
          const baseInfo = {
            index: mgr.index,
            name: managerDetails && managerDetails[idx] ? managerDetails[idx].manager : 'unknown',
            state: getStateName(mgr.state),
            stateCode: mgr.state,
            pid: mgr.pid,
            startMode: getStartModeName(mgr.startMode),
            startModeCode: mgr.startMode,
            startTime: mgr.startTime,
            managerNumber: mgr.manNum
          };

          // Add detailed configuration if requested
          if (includeDetails && managerDetails && managerDetails[idx]) {
            return {
              ...baseInfo,
              secKill: managerDetails[idx].secKill,
              restartCount: managerDetails[idx].restartCount,
              resetMin: managerDetails[idx].resetMin,
              commandlineOptions: managerDetails[idx].commandlineOptions
            };
          }

          return baseInfo;
        });

        const result = {
          managers,
          pmonStatus: {
            mode: status.modeString,
            modeCode: status.modeNumeric,
            emergencyMode: status.emergencyActive === 1,
            demoMode: status.demoModeActive === 1
          },
          totalCount: managers.length
        };

        console.log(`Found ${managers.length} managers`);
        return createSuccessResponse(result, `Successfully listed ${managers.length} managers`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing managers:', errorMessage);
        return createErrorResponse(
          `Failed to list managers: ${errorMessage}`,
          { code: 'PMON_LIST_ERROR' }
        );
      }
    }
  );

  server.tool(
    "get-manager-status",
    `Get the status of a specific manager by index.

Returns detailed status information for a single manager:
- Current state
- Process ID
- Start mode
- Start time
- Manager number

Parameters:
- managerIndex: The index of the manager (1-based, 0 is Pmon itself)`,
    {
      managerIndex: z.number().min(0).describe("Manager index (0 for Pmon, 1+ for other managers)")
    },
    async ({ managerIndex }: { managerIndex: number }) => {
      try {
        console.log(`Getting status for manager at index ${managerIndex}...`);

        const pmonClient = new PmonClient();
        const status = await pmonClient.getManagerStatus();

        // Find the manager
        const manager = status.managers.find(m => m.index === managerIndex);

        if (!manager) {
          return createErrorResponse(
            `Manager at index ${managerIndex} not found`,
            { code: 'MANAGER_NOT_FOUND' }
          );
        }

        const result = {
          index: manager.index,
          state: getStateName(manager.state),
          stateCode: manager.state,
          pid: manager.pid,
          startMode: getStartModeName(manager.startMode),
          startModeCode: manager.startMode,
          startTime: manager.startTime,
          managerNumber: manager.manNum
        };

        return createSuccessResponse(result, `Manager status retrieved successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting manager status:', errorMessage);
        return createErrorResponse(
          `Failed to get manager status: ${errorMessage}`,
          { code: 'PMON_STATUS_ERROR' }
        );
      }
    }
  );

  return 2; // Number of tools registered
}
