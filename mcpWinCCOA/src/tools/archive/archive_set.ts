/**
 * Archive Set Tool
 *
 * MCP tool for creating and updating archive configurations on datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType, DpArchiveProcessType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Default archive class
 */
const DEFAULT_ARCHIVE_CLASS = '_NGA_G_EVENT';

/**
 * Archive configuration request
 */
interface ArchiveConfigRequest {
  /** Datapoint element (e.g., 'System1:MyTag.') */
  dpe: string;
  /** Archive class name (default: _NGA_G_EVENT) */
  archiveClass?: string;
  /** Force update even if archive already exists */
  force?: boolean;
}

/**
 * Check if an archive configuration exists
 */
async function hasArchiveConfig(winccoa: any, dpe: string): Promise<boolean> {
  try {
    const archiveType = await winccoa.dpGet(`${dpe}:_archive.._type`);
    return archiveType !== DpConfigType.DPCONFIG_NONE && archiveType !== null && archiveType !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Configure archive for a datapoint element
 */
async function configureArchive(
  winccoa: any,
  dpe: string,
  archiveClass: string
): Promise<void> {
  console.log(`Setting archive configuration for ${dpe}`);
  console.log(`Archive class: ${archiveClass}`);

  // Configure archive with single archive group (detail 1)
  // Main config: _archive.._type and _archive.._archive
  // Detail 1: _archive.1._type and _archive.1._class
  await winccoa.dpSetWait(
    [
      `${dpe}:_archive.._type`,
      `${dpe}:_archive.._archive`,
      `${dpe}:_archive.1._type`,
      `${dpe}:_archive.1._class`
    ],
    [
      DpConfigType.DPCONFIG_DB_ARCHIVEINFO,
      true,
      DpArchiveProcessType.DPATTR_ARCH_PROC_VALARCH,
      archiveClass
    ]
  );

  console.log(`✓ Archive configuration set for ${dpe}`);
}

/**
 * Register archive set tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "archive-set",
    `Set or update archive configuration for a datapoint element in WinCC OA.

    Configures value archiving (DPATTR_ARCH_PROC_VALARCH) with a single archive group.

    Default archive class: _NGA_G_EVENT

    Examples:

    Simple archive configuration:
    {
      "dpe": "System1:Temperature."
    }

    With custom archive class:
    {
      "dpe": "System1:Temperature.",
      "archiveClass": "_NGA_G_EVENT_IX"
    }

    Force overwrite existing configuration:
    {
      "dpe": "System1:Temperature.",
      "archiveClass": "_NGA_G_EVENT",
      "force": true
    }

    CAUTION: Archive configurations affect historical data storage. Use with care.
    `,
    {
      config: z.union([
        z.object({
          dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)'),
          archiveClass: z.string().optional().describe('Archive class name (default: _NGA_G_EVENT)'),
          force: z.boolean().optional().describe('Force update even if archive exists')
        }),
        z.string()
      ])
    },
    async ({ config }: { config: ArchiveConfigRequest | string }) => {
      try {
        // Parse string if needed
        let parsedConfig: ArchiveConfigRequest = typeof config === 'string' ? JSON.parse(config) : config;

        console.log('========================================');
        console.log('Setting Archive Configuration');
        console.log('========================================');
        console.log(`DPE: ${parsedConfig.dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(parsedConfig.dpe)) {
          throw new Error(`DPE ${parsedConfig.dpe} does not exist in the system`);
        }

        // Use default archive class if not provided
        const archiveClass = parsedConfig.archiveClass || DEFAULT_ARCHIVE_CLASS;

        // Check if archive configuration already exists
        const hasConfig = await hasArchiveConfig(winccoa, parsedConfig.dpe);
        if (hasConfig && !parsedConfig.force) {
          return createErrorResponse(
            `Archive configuration already exists for ${parsedConfig.dpe}. Use force: true to overwrite.`
          );
        }

        // Configure archive
        await configureArchive(winccoa, parsedConfig.dpe, archiveClass);

        console.log('========================================');
        console.log('✓ Archive Configuration Complete');
        console.log('========================================');

        return createSuccessResponse({
          dpe: parsedConfig.dpe,
          message: 'Archive configuration set successfully',
          archiveClass: archiveClass,
          archiveType: 'DPATTR_ARCH_PROC_VALARCH'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Archive Configuration Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to set archive configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}
