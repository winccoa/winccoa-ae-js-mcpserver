/**
 * PV Range Query Tool
 *
 * MCP tool for querying existing pv_range configurations from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse, describeWinccoaError } from '../../utils/helpers.js';
import * as log from '../../utils/logger.js';
import { DpConfigType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/** WinCC OA error 19: "attribute does not exist in this config" - i.e. not configured. */
const ERR_ATTRIBUTE_NOT_IN_CONFIG = 19;

/**
 * True if the error only says the attribute does not exist in the config
 * (code 19, directly or in every nested detail). That is the normal answer
 * for a datapoint element without a pv_range config, not a failure.
 */
export function isNotConfiguredError(error: unknown): boolean {
  const described = describeWinccoaError(error);
  if (described.details.length > 0) {
    return described.details.every(d => d.code === ERR_ATTRIBUTE_NOT_IN_CONFIG);
  }
  return described.code === ERR_ATTRIBUTE_NOT_IN_CONFIG;
}

/**
 * Read one _pv_range attribute.
 * @returns The value, or undefined if the attribute does not exist in this config
 * @throws Any other WinCC OA error
 */
async function readRangeAttribute(winccoa: any, dpe: string, attribute: string): Promise<any> {
  try {
    return await winccoa.dpGet(`${dpe}:_pv_range.._${attribute}`);
  } catch (error) {
    if (isNotConfiguredError(error)) {
      log.debug(`${dpe}:_pv_range.._${attribute} does not exist in this config`);
      return undefined;
    }
    throw error;
  }
}

/**
 * Query range configuration for a datapoint element
 * @returns The configuration, or null if no pv_range config exists
 * @throws On real WinCC OA errors (not on "not configured")
 */
export async function queryRangeConfig(winccoa: any, dpe: string): Promise<any> {
  // Read the config type first: without a config, the other attributes do not
  // exist and reading them only produces errors.
  const configType = await readRangeAttribute(winccoa, dpe, 'type');

  if (configType === DpConfigType.DPCONFIG_NONE || configType === null || configType === undefined) {
    return null;
  }

  // Not every range type has every attribute (e.g. a set range check has no
  // min/max); those come back as undefined.
  const [minValue, maxValue, includeMin, includeMax] = await Promise.all([
    readRangeAttribute(winccoa, dpe, 'min'),
    readRangeAttribute(winccoa, dpe, 'max'),
    readRangeAttribute(winccoa, dpe, 'incl_min'),
    readRangeAttribute(winccoa, dpe, 'incl_max')
  ]);

  return {
    type: configType,
    min: minValue,
    max: maxValue,
    includeMin: includeMin,
    includeMax: includeMax,
    configured: true
  };
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

    If no pv_range configuration exists, returns
    {"dpe": "...", "configured": false, "message": "No pv_range configuration exists for this datapoint element"}.
    Attributes that do not exist for the configured range type are omitted.
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

        const described = describeWinccoaError(error);
        return createErrorResponse(`Failed to query pv_range configuration: ${described.message}`, {
          ...(described.code !== undefined ? { errorCode: described.code } : {}),
          ...(described.details.length > 0 ? { details: described.details } : {})
        });
      }
    }
  );

  return 1; // Number of tools registered
}
