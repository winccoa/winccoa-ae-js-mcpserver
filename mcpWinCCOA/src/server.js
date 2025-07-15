import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from 'winccoa-manager';
import { loadFieldConfigurations, getActiveField, loadProjectConfiguration } from './field_loader.js';
import { initializeResources } from './resources/field_resources.js';
import { loadAllTools } from './tool_loader.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

let winccoa = null;
let fieldConfigs = {};
let activeFieldName = 'default';
let projectConfig = null;
let systemPrompt = null;

/**
 * Load system prompt from systemprompt.md file
 * @returns {string|null} System prompt content or null if file doesn't exist
 */
function loadSystemPrompt() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const systemPromptPath = join(__dirname, 'systemprompt.md');
    
    console.log('🔄 Loading system prompt from:', systemPromptPath);
    const content = readFileSync(systemPromptPath, 'utf8');
    console.log('✅ System prompt loaded successfully');
    return content;
  } catch (error) {
    console.warn('⚠️ Could not load system prompt:', error.message);
    return null;
  }
}

/**
 * Initialize the MCP server with all tools and resources
 * @returns {Promise<McpServer>} Configured MCP server
 */
export async function initializeServer() {
  console.log('🔄 Starting MCP server initialization...');
  
  try {
    // Initialize WinCC OA manager
    console.log('🔄 Initializing WinCC OA manager...');
    winccoa = new WinccoaManager();
    console.log('✅ WinCC OA manager initialized');
    
    // Load field and project configurations
    console.log('🔄 Loading field configurations...');
    fieldConfigs = await loadFieldConfigurations();
    console.log('✅ Field configurations loaded:', Object.keys(fieldConfigs));
    
    console.log('🔄 Getting active field...');
    activeFieldName = getActiveField();
    console.log('✅ Active field:', activeFieldName);
    
    console.log('🔄 Loading project configuration...');
    projectConfig = await loadProjectConfiguration();
    console.log('✅ Project configuration loaded:', projectConfig ? 'SUCCESS' : 'NONE');
    
    console.log('🔄 Loading system prompt...');
    systemPrompt = loadSystemPrompt();
    console.log('✅ System prompt loaded:', systemPrompt ? 'SUCCESS' : 'NONE');
    
    // Create server instance
    console.log('🔄 Creating MCP server instance...');
    const server = new McpServer({
      name: "WinCC OA Extended with CNS/UNS",
      version: "3.0.0",
      capabilities: {
        resources: {
          list: true,
          read: true
        },
        tools: {},
      },
    });
    console.log('✅ MCP server instance created');
    
    // Create context object for sharing state
    console.log('🔄 Creating context object...');
    const context = {
      winccoa,
      fieldConfigs,
      activeFieldName,
      projectConfig,
      systemPrompt
    };
    console.log('✅ Context object created');
    
    // Initialize resources
    console.log('🔄 Initializing resources...');
    await initializeResources(server, context);
    console.log('✅ Resources initialized');
    
    // Load and register all tools
    console.log('🔄 Loading and registering tools...');
    await loadAllTools(server, context);
    console.log('✅ Tools loaded and registered');
    
    console.log(`✅ MCP Server initialized successfully. Active field: ${activeFieldName}`);
    if (projectConfig) {
      console.log(`✅ Project configuration loaded: ${projectConfig.name}`);
    }
    
    return server;
    
  } catch (error) {
    console.error('❌ Error during MCP server initialization:', error);
    console.error('❌ Initialization error stack:', error.stack);
    throw error;
  }
}

/**
 * Get the current context (for testing or debugging)
 * @returns {Object} Current server context
 */
export function getContext() {
  return {
    winccoa,
    fieldConfigs,
    activeFieldName,
    projectConfig,
    systemPrompt
  };
}