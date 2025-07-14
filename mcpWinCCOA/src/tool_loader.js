import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Dynamically load and register all tools from the tools directory
 * @param {McpServer} server - The MCP server instance
 * @param {Object} context - Shared context with winccoa, configs, etc.
 */
export async function loadAllTools(server, context) {
  const toolsDir = join(__dirname, 'tools');
  const toolCategories = ['datapoints', 'cns', 'alerts', 'system'];
  
  let totalTools = 0;
  
  for (const category of toolCategories) {
    const categoryPath = join(toolsDir, category);
    
    try {
      // Check if category directory exists
      await fs.access(categoryPath);
      
      // Get all .js files in the category
      const files = await fs.readdir(categoryPath);
      const jsFiles = files.filter(file => file.endsWith('.js'));
      
      console.log(`Loading ${jsFiles.length} tool files from ${category}/`);
      
      // Load each tool file
      for (const file of jsFiles) {
        try {
          const toolPath = join(categoryPath, file);
          const relativePath = `./tools/${category}/${file}`;
          
          // Dynamic import of the tool module
          const toolModule = await import(relativePath);
          
          // Register tools if the module has a registerTools function
          if (typeof toolModule.registerTools === 'function') {
            const toolCount = await toolModule.registerTools(server, context);
            totalTools += toolCount || 0;
            console.log(`  ✓ Loaded ${file} (${toolCount || 'unknown'} tools)`);
          } else {
            console.warn(`  ⚠ ${file} does not export registerTools function`);
          }
        } catch (error) {
          console.error(`  ✗ Failed to load ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.log(`Category ${category}/ not found or empty, skipping`);
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