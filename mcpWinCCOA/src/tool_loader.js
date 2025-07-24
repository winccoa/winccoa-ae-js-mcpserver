import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dynamically load and register tools based on TOOLS environment variable
 * @param {McpServer} server - The MCP server instance
 * @param {Object} context - Shared context with winccoa, configs, etc.
 */
export async function loadAllTools(server, context) {
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
      const toolModule = await import(relativePath);
      
      // Register tools if the module has a registerTools function
      if (typeof toolModule.registerTools === 'function') {
        const toolCount = await toolModule.registerTools(server, context);
        totalTools += toolCount || 0;
        console.log(`  ✓ Loaded ${toolPath} (${toolCount || 'unknown'} tools)`);
      } else {
        console.warn(`  ⚠ ${toolPath} does not export registerTools function`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to load ${toolPath}:`, error.message);
    }
  }
  
  console.log(`Total tools registered: ${totalTools}`);
}

/**
 * Load tools from a specific category (for testing)
 * @param {McpServer} server - The MCP server instance
 * @param {Object} context - Shared context
 * @param {string} category - Tool category to load
 */
export async function loadToolCategory(server, context, category) {
  const categoryPath = join(__dirname, 'tools', category);
  
  try {
    const files = await fs.readdir(categoryPath);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    
    for (const file of jsFiles) {
      const relativePath = `./tools/${category}/${file}`;
      const toolModule = await import(relativePath);
      
      if (typeof toolModule.registerTools === 'function') {
        await toolModule.registerTools(server, context);
      }
    }
  } catch (error) {
    console.error(`Failed to load category ${category}:`, error.message);
  }
}