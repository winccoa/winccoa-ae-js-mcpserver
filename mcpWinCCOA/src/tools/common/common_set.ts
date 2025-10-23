/**
 * Common Config Set Tool
 *
 * MCP tool for setting common config attributes on datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Common config set request
 */
interface CommonConfigSetRequest {
  /** Datapoint element (e.g., 'System1:MyTag.') */
  dpe: string;
  /** Multi-language description (UTF-8) or simple string */
  description?: any;
  /** Alias name */
  alias?: string;
  /** Multi-language format (UTF-8) or simple string */
  format?: any;
  /** Multi-language unit (UTF-8) or simple string */
  unit?: any;
}

/**
 * Set common config attributes for a datapoint element
 * All parameters are optional and independent
 */
async function setCommonConfig(
  winccoa: any,
  dpe: string,
  description?: any,
  alias?: string,
  format?: any,
  unit?: any
): Promise<string[]> {
  const setAttributes: string[] = [];

  try {
    // Set description if provided
    if (description !== undefined) {
      console.log(`Setting description for ${dpe}`);
      await winccoa.dpSetDescription(dpe, description);
      setAttributes.push('description');
    }

    // Set alias if provided
    if (alias !== undefined) {
      console.log(`Setting alias for ${dpe}`);
      await winccoa.dpSetAlias(dpe, alias);
      setAttributes.push('alias');
    }

    // Set format if provided
    if (format !== undefined) {
      console.log(`Setting format for ${dpe}`);
      await winccoa.dpSetFormat(dpe, format);
      setAttributes.push('format');
    }

    // Set unit if provided
    if (unit !== undefined) {
      console.log(`Setting unit for ${dpe}`);
      await winccoa.dpSetUnit(dpe, unit);
      setAttributes.push('unit');
    }

    return setAttributes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to set attributes (successfully set: ${setAttributes.join(', ')}): ${errorMessage}`);
  }
}

/**
 * Register common config set tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "common-set",
    `Set one or more common config attributes for a datapoint element in WinCC OA.

    All parameters are optional and independent. You can set any combination from 0 to 4 attributes.
    Attributes not specified will remain unchanged.
    Does NOT require existing _common config - WinCC OA creates it automatically.

    Language Strings (description, format, unit):
    - Simple string: "Temperature" (auto-converted to UTF-8 default language)
    - Multi-language UTF-8: { "en_US.utf8": "Temperature", "de_AT.utf8": "Temperatur" }
    - IMPORTANT: Language strings MUST use UTF-8 encoding (.utf8), NOT ISO encoding

    Examples:

    Set only unit:
    {
      "dpe": "System1:Temperature.",
      "unit": "°C"
    }

    Set description and unit:
    {
      "dpe": "System1:Temperature.",
      "description": "Sensor temperature",
      "unit": "°C"
    }

    Set all four attributes:
    {
      "dpe": "System1:Temperature.",
      "description": { "en_US.utf8": "Temperature", "de_AT.utf8": "Temperatur" },
      "alias": "TempSensor1",
      "format": "%6.2f",
      "unit": { "en_US.utf8": "°C", "de_AT.utf8": "°C" }
    }

    Set only alias:
    {
      "dpe": "System1:Pump.",
      "alias": "MainPump"
    }

    Returns: Success with list of attributes that were set.
    `,
    {
      config: z.union([
        z.object({
          dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)'),
          description: z.any().optional().describe('Multi-language description (UTF-8) or string'),
          alias: z.string().optional().describe('Alias name'),
          format: z.any().optional().describe('Multi-language format (UTF-8) or string'),
          unit: z.any().optional().describe('Multi-language unit (UTF-8) or string')
        }),
        z.string()
      ])
    },
    async ({ config }: { config: CommonConfigSetRequest | string }) => {
      try {
        // Parse string if needed
        let parsedConfig: CommonConfigSetRequest = typeof config === 'string' ? JSON.parse(config) : config;

        console.log('========================================');
        console.log('Setting Common Config');
        console.log('========================================');
        console.log(`DPE: ${parsedConfig.dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(parsedConfig.dpe)) {
          throw new Error(`DPE ${parsedConfig.dpe} does not exist in the system`);
        }

        // Validate at least one attribute is provided
        if (
          parsedConfig.description === undefined &&
          parsedConfig.alias === undefined &&
          parsedConfig.format === undefined &&
          parsedConfig.unit === undefined
        ) {
          throw new Error('At least one attribute must be provided (description, alias, format, or unit)');
        }

        // Set the common config attributes
        const setAttributes = await setCommonConfig(
          winccoa,
          parsedConfig.dpe,
          parsedConfig.description,
          parsedConfig.alias,
          parsedConfig.format,
          parsedConfig.unit
        );

        console.log(`✓ Set attributes: ${setAttributes.join(', ')}`);
        console.log('========================================');
        console.log('✓ Common Config Set Complete');
        console.log('========================================');

        return createSuccessResponse({
          dpe: parsedConfig.dpe,
          message: 'Common config attributes set successfully',
          setAttributes: setAttributes
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Common Config Set Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to set common config: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
