/**
 * Tool Loader
 *
 * Dynamically loads and registers MCP tools based on configuration.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as log from './utils/logger.js';
import type { ServerContext, ToolModule, ToolRegistrationResult } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Emit the registration summary once per process, not once per request. */
let summaryLogged = false;

/**
 * Module load failures already reported at error level. The HTTP transport
 * registers tools on every request, so without this a broken module logs the
 * same failure on every request.
 */
const reportedFailures = new Set<string>();

/** Result of one loadAllTools() run. */
export interface ToolLoadSummary {
  /** Number of modules configured in TOOLS */
  configuredModules: number;
  /** Modules whose registerTools() completed */
  loadedModules: number;
  /** Tools registered by the loaded modules */
  totalTools: number;
  /** Modules that failed to import or register, with the reason */
  failedModules: Array<{ module: string; error: string }>;
}

/**
 * Reset the once-per-process logging state (for tests).
 * @internal
 */
export function resetToolLoaderLogState(): void {
  summaryLogged = false;
  reportedFailures.clear();
}

/**
 * Dynamically load and register tools based on TOOLS environment variable
 * @param server - The MCP server instance
 * @param context - Shared server context
 * @returns Counts of what was actually registered
 */
export async function loadAllTools(server: any, context: ServerContext): Promise<ToolLoadSummary> {
  const toolsToLoad = process.env.TOOLS
    ? process.env.TOOLS.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  const summary: ToolLoadSummary = {
    configuredModules: toolsToLoad.length,
    loadedModules: 0,
    totalTools: 0,
    failedModules: []
  };

  if (toolsToLoad.length === 0) {
    log.warn('No tools configured in TOOLS environment variable');
    return summary;
  }

  log.debug(`Loading ${toolsToLoad.length} configured tools`);

  for (const toolPath of toolsToLoad) {
    try {
      const relativePath = `./tools/${toolPath}.js`;

      // Dynamic import of the tool module
      const toolModule = (await import(relativePath)) as ToolModule;

      // Register tools if the module has a registerTools function
      if (typeof toolModule.registerTools === 'function') {
        const toolCount = await toolModule.registerTools(server, context);
        summary.totalTools += toolCount || 0;
        summary.loadedModules++;
        log.debug(`  ✓ Loaded ${toolPath} (${toolCount || 'unknown'} tools)`);
      } else {
        summary.failedModules.push({ module: toolPath, error: 'does not export registerTools' });
        if (!reportedFailures.has(toolPath)) {
          reportedFailures.add(toolPath);
          log.warn(`  ⚠ ${toolPath} does not export registerTools function`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      summary.failedModules.push({ module: toolPath, error: errorMessage });
      if (!reportedFailures.has(toolPath)) {
        reportedFailures.add(toolPath);
        log.error(
          `  ✗ Failed to load ${toolPath}: ${errorMessage} ` +
            '(reported once per process; set MCP_LOG_LEVEL=debug to see it on every request)'
        );
      } else {
        log.debug(`  ✗ Failed to load ${toolPath}: ${errorMessage}`);
      }
    }
  }

  // The HTTP transport builds a fresh server per request, so this runs on every
  // request. Logging the full 27-module breakdown each time floods the WinCC OA
  // log - it was truncating PVSS_II.log in testing - so the detail is behind
  // MCP_LOG_LEVEL=debug and the summary is emitted once per process.
  const failedNote =
    summary.failedModules.length > 0
      ? `; ${summary.failedModules.length} failed: ${summary.failedModules.map(f => f.module).join(', ')}`
      : '';
  if (!summaryLogged) {
    summaryLogged = true;
    log.info(
      `Registered ${summary.totalTools} tools from ${summary.loadedModules} of ` +
        `${summary.configuredModules} modules${failedNote} ` +
        '(subsequent requests reuse this set; set MCP_LOG_LEVEL=debug for per-request detail)'
    );
  } else {
    log.debug(
      `Total tools registered: ${summary.totalTools} from ${summary.loadedModules} of ` +
        `${summary.configuredModules} modules${failedNote}`
    );
  }

  return summary;
}

/**
 * Load tools from a specific category (for testing)
 * @param server - The MCP server instance
 * @param context - Shared context
 * @param category - Tool category to load
 * @returns Results of tool registration
 */
export async function loadToolCategory(
  server: any,
  context: ServerContext,
  category: string
): Promise<ToolRegistrationResult[]> {
  const results: ToolRegistrationResult[] = [];

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const categoryPath = path.join(__dirname, 'tools', category);

    const files = await fs.readdir(categoryPath);
    const jsFiles = files.filter(file => file.endsWith('.js'));

    for (const file of jsFiles) {
      try {
        const relativePath = `./tools/${category}/${file}`;
        const toolModule = (await import(relativePath)) as ToolModule;

        if (typeof toolModule.registerTools === 'function') {
          const count = await toolModule.registerTools(server, context);
          results.push({
            category: `${category}/${file}`,
            count: count || 0,
            success: true
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          category: `${category}/${file}`,
          count: 0,
          success: false,
          error: errorMessage
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load category ${category}:`, errorMessage);
    results.push({
      category,
      count: 0,
      success: false,
      error: errorMessage
    });
  }

  return results;
}
