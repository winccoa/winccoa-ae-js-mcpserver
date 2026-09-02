/**
 * Common Config Query Tool
 *
 * MCP tool for querying existing common config attributes from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import * as log from '../../utils/logger.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Query common config attributes for a datapoint element
 */
async function queryCommonConfig(winccoa: any, dpe: string): Promise<any> {
  const result: any = { dpe, configured: false };
  let hasConfig = false;
  const unreadable: string[] = [];

  /**
   * Read one attribute, treating "not configured" as an absence rather than a
   * failure.
   *
   * WinCC OA throws for an unset attribute - dpGetAlias raises error 76,
   * "no such alias" - so reading all four inside a single try meant one unset
   * attribute aborted the whole query and the tool reported failure for a
   * perfectly normal datapoint. The caller then could not distinguish "nothing
   * configured" from a real error, which is what pv_range-query gets right.
   */
  const read = (attribute: string, get: () => unknown): unknown => {
    try {
      return get();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Keep this at debug: for most datapoints an unset attribute is the norm.
      log.debug(`  ${attribute} not readable on ${dpe}: ${message}`);
      unreadable.push(attribute);
      return undefined;
    }
  };

  const description = read('description', () => winccoa.dpGetDescription(dpe));
  const alias = read('alias', () => winccoa.dpGetAlias(dpe));
  const format = read('format', () => winccoa.dpGetFormat(dpe));
  const unit = read('unit', () => winccoa.dpGetUnit(dpe));

  if (description && Object.keys(description).length > 0) {
    result.description = description;
    hasConfig = true;
  }

  if (typeof alias === 'string' && alias.trim() !== '') {
    result.alias = alias;
    hasConfig = true;
  }

  if (format && Object.keys(format).length > 0) {
    result.format = format;
    hasConfig = true;
  }

  if (unit && Object.keys(unit).length > 0) {
    result.unit = unit;
    hasConfig = true;
  }

  result.configured = hasConfig;

  // Report which attributes could not be read, so an unset attribute and a real
  // read failure remain distinguishable by the caller.
  if (unreadable.length > 0) {
    result.notConfigured = unreadable;
  }

  return result;
}

/**
 * Register common config query tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "common-query",
    `Query existing common config attributes (description, alias, format, unit) from a datapoint element in WinCC OA.

    Returns the current common config attributes. All language strings are UTF-8 encoded.

    Example:
    {
      "dpe": "System1:Temperature."
    }

    Returns:
    - description: Multi-language description (UTF-8 encoded)
    - alias: Alias name (string)
    - format: Multi-language format string (UTF-8 encoded)
    - unit: Multi-language engineering unit (UTF-8 encoded)
    - configured: true if any attribute exists

    Returns only attributes that are set. Omits empty/undefined attributes.
    Returns configured: false if no common config attributes exist.
    `,
    {
      dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)')
    },
    async ({ dpe }: { dpe: string }) => {
      try {
        console.log('========================================');
        console.log('Querying Common Config');
        console.log('========================================');
        console.log(`DPE: ${dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(dpe)) {
          throw new Error(`DPE ${dpe} does not exist in the system`);
        }

        // Query the common config
        const commonConfig = await queryCommonConfig(winccoa, dpe);

        if (!commonConfig.configured) {
          console.log('No common config attributes found');
          console.log('========================================');
          return createSuccessResponse({
            dpe: dpe,
            configured: false,
            message: 'No common config attributes exist for this datapoint element'
          });
        }

        console.log(`Description: ${commonConfig.description ? 'set' : 'not set'}`);
        console.log(`Alias: ${commonConfig.alias || 'not set'}`);
        console.log(`Format: ${commonConfig.format ? 'set' : 'not set'}`);
        console.log(`Unit: ${commonConfig.unit ? 'set' : 'not set'}`);
        console.log('========================================');
        console.log('✓ Common Config Query Complete');
        console.log('========================================');

        return createSuccessResponse(commonConfig);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Common Config Query Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to query common config: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
