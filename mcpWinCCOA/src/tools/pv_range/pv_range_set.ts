/**
 * PV Range Set Tool
 *
 * MCP tool for creating and updating pv_range (min/max) configurations on datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType, DpeType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Range configuration request
 */
interface RangeConfigRequest {
  /** Datapoint element (e.g., 'System1:MyTag.') */
  dpe: string;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Include minimum value in valid range (default: true) */
  includeMin?: boolean;
  /** Include maximum value in valid range (default: true) */
  includeMax?: boolean;
  /** Force update even if range already exists */
  force?: boolean;
}

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
 * Get the datapoint element type
 */
function getDpeType(winccoa: any, dpe: string): number {
  try {
    return winccoa.dpElementType(dpe);
  } catch (error) {
    throw new Error(`Cannot determine type of DPE ${dpe}: ${error}`);
  }
}

/**
 * Validate that DPE type supports range configuration
 */
function validateDpeTypeForRange(dpeType: number): void {
  const supportedTypes = [
    DpeType.DPEL_CHAR,
    DpeType.DPEL_INT,
    DpeType.DPEL_UINT,
    DpeType.DPEL_LONG,
    DpeType.DPEL_ULONG,
    DpeType.DPEL_FLOAT
  ];

  if (!supportedTypes.includes(dpeType)) {
    throw new Error(
      `Unsupported DPE type: ${dpeType}. Range configuration only supports numeric types: CHAR (19), INT (21), UINT (20), LONG (54), ULONG (58), FLOAT (22)`
    );
  }
}

/**
 * Configure pv_range for a datapoint element
 */
async function configureRange(
  winccoa: any,
  dpe: string,
  min: number,
  max: number,
  includeMin: boolean,
  includeMax: boolean
): Promise<void> {
  console.log(`Setting pv_range configuration for ${dpe}`);
  console.log(`Min: ${min} (${includeMin ? 'inclusive' : 'exclusive'}), Max: ${max} (${includeMax ? 'inclusive' : 'exclusive'})`);

  // Validate min < max
  if (min >= max) {
    throw new Error(`Minimum value (${min}) must be less than maximum value (${max})`);
  }

  // Configure range with all parameters
  await winccoa.dpSetWait(
    [
      `${dpe}:_pv_range.._type`,
      `${dpe}:_pv_range.._min`,
      `${dpe}:_pv_range.._max`,
      `${dpe}:_pv_range.._incl_min`,
      `${dpe}:_pv_range.._incl_max`
    ],
    [
      DpConfigType.DPCONFIG_MINMAX_PVSS_RANGECHECK,
      min,
      max,
      includeMin,
      includeMax
    ]
  );

  console.log(`✓ PV Range configuration set for ${dpe}`);
}

/**
 * Register pv_range set tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "pv-range-set",
    `Set or update pv_range (min/max) configuration for a datapoint element in WinCC OA.

    Configures value range checking with minimum and maximum limits.
    The includeMin and includeMax parameters control whether the boundary values are included in the valid range.

    Default behavior: Both min and max values are included in the valid range (includeMin=true, includeMax=true).

    Supported datapoint types: CHAR, INT, UINT, LONG, ULONG, FLOAT

    Examples:

    Simple range configuration (inclusive boundaries):
    {
      "dpe": "System1:Temperature.",
      "min": 0,
      "max": 100
    }

    Range with exclusive boundaries:
    {
      "dpe": "System1:Pressure.",
      "min": 0,
      "max": 10,
      "includeMin": false,
      "includeMax": false
    }

    Range with mixed boundaries (min exclusive, max inclusive):
    {
      "dpe": "System1:Level.",
      "min": 0,
      "max": 5,
      "includeMin": false,
      "includeMax": true
    }

    Force overwrite existing configuration:
    {
      "dpe": "System1:Temperature.",
      "min": -50,
      "max": 150,
      "force": true
    }

    CAUTION: Range configurations affect value validation. Use with care.
    `,
    {
      config: z.union([
        z.object({
          dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)'),
          min: z.number().describe('Minimum value'),
          max: z.number().describe('Maximum value'),
          includeMin: z.boolean().optional().describe('Include minimum value in valid range (default: true)'),
          includeMax: z.boolean().optional().describe('Include maximum value in valid range (default: true)'),
          force: z.boolean().optional().describe('Force update even if range exists')
        }),
        z.string()
      ])
    },
    async ({ config }: { config: RangeConfigRequest | string }) => {
      try {
        // Parse string if needed
        let parsedConfig: RangeConfigRequest = typeof config === 'string' ? JSON.parse(config) : config;

        console.log('========================================');
        console.log('Setting PV Range Configuration');
        console.log('========================================');
        console.log(`DPE: ${parsedConfig.dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(parsedConfig.dpe)) {
          throw new Error(`DPE ${parsedConfig.dpe} does not exist in the system`);
        }

        // Get DPE type and validate
        const dpeType = getDpeType(winccoa, parsedConfig.dpe);
        console.log(`DPE Type: ${dpeType}`);
        validateDpeTypeForRange(dpeType);

        // Check if range configuration already exists
        const hasConfig = await hasRangeConfig(winccoa, parsedConfig.dpe);
        if (hasConfig && !parsedConfig.force) {
          return createErrorResponse(
            `PV Range configuration already exists for ${parsedConfig.dpe}. Use force: true to overwrite.`
          );
        }

        // Default values for includeMin and includeMax
        const includeMin = parsedConfig.includeMin !== undefined ? parsedConfig.includeMin : true;
        const includeMax = parsedConfig.includeMax !== undefined ? parsedConfig.includeMax : true;

        // Configure range
        await configureRange(
          winccoa,
          parsedConfig.dpe,
          parsedConfig.min,
          parsedConfig.max,
          includeMin,
          includeMax
        );

        console.log('========================================');
        console.log('✓ PV Range Configuration Complete');
        console.log('========================================');

        return createSuccessResponse({
          dpe: parsedConfig.dpe,
          message: 'PV Range configuration set successfully',
          min: parsedConfig.min,
          max: parsedConfig.max,
          includeMin: includeMin,
          includeMax: includeMax
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ PV Range Configuration Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to set pv_range configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
