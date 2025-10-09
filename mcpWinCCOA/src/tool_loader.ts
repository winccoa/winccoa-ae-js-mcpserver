/**
 * Tool Loader
 *
 * Dynamically loads and registers MCP tools based on configuration.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { ServerContext, ToolModule, ToolRegistrationResult } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dynamically load and register tools based on TOOLS environment variable
 * @param server - The MCP server instance
 * @param context - Shared server context
 */
export async function loadAllTools(server: any, context: ServerContext): Promise<void> {
  const toolsToLoad = process.env.TOOLS ? process.env.TOOLS.split(',').map(t => t.trim()) : [];

  if (toolsToLoad.length === 0) {
    console.log('No tools configured in TOOLS environment variable');
    return;
  }

  let totalTools = 0;

  console.log(`Loading ${toolsToLoad.length} configured tools`);

  for (const toolPath of toolsToLoad) {
    try {
      const relativePath = `./tools/${toolPath}.js`;

      // Dynamic import of the tool module
      const toolModule = (await import(relativePath)) as ToolModule;

      // Register tools if the module has a registerTools function
      if (typeof toolModule.registerTools === 'function') {
        const toolCount = await toolModule.registerTools(server, context);
        totalTools += toolCount || 0;
        console.log(`  ✓ Loaded ${toolPath} (${toolCount || 'unknown'} tools)`);
      } else {
        console.warn(`  ⚠ ${toolPath} does not export registerTools function`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed to load ${toolPath}:`, errorMessage);
    }
  }

  console.log(`Total tools registered: ${totalTools}`);
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
