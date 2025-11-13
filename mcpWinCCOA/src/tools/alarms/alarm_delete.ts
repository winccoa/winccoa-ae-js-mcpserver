/**
 * Alarm Delete Tool
 *
 * MCP tool for deleting alarm configurations from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType, DpAlertAckType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Check if an alert configuration exists
 */
async function hasAlertConfig(winccoa: any, dpe: string): Promise<boolean> {
  try {
    const alertType = await winccoa.dpGet(`${dpe}:_alert_hdl.._type`);
    return alertType !== DpConfigType.DPCONFIG_NONE && alertType !== null && alertType !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Deactivate an alert configuration
 */
async function deactivateAlert(winccoa: any, dpe: string): Promise<boolean> {
  try {
    await winccoa.dpSetWait(`${dpe}:_alert_hdl.._active`, false);
    return true;
  } catch (error) {
    console.error(`Error deactivating alert for ${dpe}:`, error);
    return false;
  }
}

/**
 * Register alarm delete tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "alarm-delete",
    `Delete alarm configuration from a datapoint element in WinCC OA.

    This tool:
    1. Acknowledges the alert
    2. Deactivates the alert
    3. Deletes the alert configuration

    Example:
    {
      "dpe": "System1:MyTag."
    }

    CAUTION: This permanently removes alarm configurations. Ensure this is intended before executing.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Deleting Alarm Configuration');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Check if alert configuration exists
        const hasConfig = await hasAlertConfig(winccoa, dpe);
        if (!hasConfig) {
          return createErrorResponse(
            `No alert configuration exists for ${dpe}`
          );
        }

        // Acknowledge the alert (SINGLE acknowledge type)
        console.log(`🔔 Acknowledging alert for ${dpe}`);
        await winccoa.dpSetWait(`${dpe}:_alert_hdl.._ack`, DpAlertAckType.DPATTR_ACKTYPE_SINGLE);

        // Deactivate the alert
        console.log(`🔔 Deactivating alert for ${dpe}`);
        const deactivated = await deactivateAlert(winccoa, dpe);
        if (!deactivated) {
          throw new Error('Failed to deactivate alert');
        }

        // Delete the configuration
        console.log(`🔔 Deleting alert configuration for ${dpe}`);
        await winccoa.dpSetWait(`${dpe}:_alert_hdl.._type`, DpConfigType.DPCONFIG_NONE);

        console.log('========================================');
        console.log('✓ Alarm Configuration Deleted');
        console.log('========================================');

        return createSuccessResponse({
          dpe: dpe,
          message: 'Alarm configuration deleted successfully'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Alarm Deletion Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to delete alarm configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
