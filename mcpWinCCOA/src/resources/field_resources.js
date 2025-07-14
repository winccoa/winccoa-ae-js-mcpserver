import { parseFieldRules, mergeRules, mergeInstructions } from '../field_loader.js';

/**
 * Initialize all field and project related resources
 * @param {McpServer} server - MCP server instance
 * @param {Object} context - Server context with configs
 */
export async function initializeResources(server, context) {
  const { fieldConfigs, activeFieldName, projectConfig } = context;
  
  // Resource: List of available fields
  server.resource("field://list", "List of all available field configurations", async () => {
    const fields = Object.keys(fieldConfigs).map(name => ({
      name: name,
      active: name === activeFieldName,
      hasContent: fieldConfigs[name].content.length > 0
    }));
    
    return {
      contents: [{
        uri: "field://list",
        mimeType: "application/json",
        text: JSON.stringify(fields, null, 2)
      }]
    };
  });
  
  // Resource: Active field name
  server.resource("field://active", "Currently active field configuration", async () => {
    return {
      contents: [{
        uri: "field://active",
        mimeType: "text/plain",
        text: activeFieldName
      }]
    };
  });
  
  // Resource: Active field instructions (including project overrides)
  server.resource("field://active-instructions", "Instructions for the currently active field (including project overrides)", async () => {
    const fieldConfig = fieldConfigs[activeFieldName] || fieldConfigs.default;
    
    // Merge with project instructions if available
    const mergedContent = projectConfig 
      ? mergeInstructions(fieldConfig.content, projectConfig.content)
      : fieldConfig.content;
    
    return {
      contents: [{
        uri: "field://active-instructions",
        mimeType: "text/markdown",
        text: mergedContent
      }]
    };
  });
  
  // Resource: Field instructions for specific field
  server.resource("field://instructions/*", "Field-specific instructions", async (uri) => {
    // Extract field name from URI
    const match = uri.match(/^field:\/\/instructions\/(.+)$/);
    if (!match) {
      throw new Error("Invalid field instructions URI");
    }
    
    const fieldName = match[1];
    const config = fieldConfigs[fieldName];
    
    if (!config) {
      throw new Error(`Field configuration '${fieldName}' not found`);
    }
    
    return {
      contents: [{
        uri: uri,
        mimeType: "text/markdown",
        text: config.content
      }]
    };
  });
  
  // Resource: Field rules for specific field
  server.resource("field://rules/*", "Parsed rules for a specific field", async (uri) => {
    const match = uri.match(/^field:\/\/rules\/(.+)$/);
    if (!match) {
      throw new Error("Invalid field rules URI");
    }
    
    const fieldName = match[1];
    const config = fieldConfigs[fieldName];
    
    if (!config) {
      throw new Error(`Field configuration '${fieldName}' not found`);
    }
    
    const rules = parseFieldRules(config.content);
    
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify(rules, null, 2)
      }]
    };
  });
  
  // Resource: Active field rules (including project overrides)
  server.resource("field://active-rules", "Parsed rules for the currently active field (including project overrides)", async () => {
    const fieldConfig = fieldConfigs[activeFieldName] || fieldConfigs.default;
    const fieldRules = parseFieldRules(fieldConfig.content);
    
    // Merge with project rules if available
    let finalRules = fieldRules;
    if (projectConfig) {
      const projectRules = parseFieldRules(projectConfig.content);
      finalRules = mergeRules(fieldRules, projectRules);
    }
    
    return {
      contents: [{
        uri: "field://active-rules",
        mimeType: "application/json",
        text: JSON.stringify(finalRules, null, 2)
      }]
    };
  });
  
  // Resource: Project configuration status
  server.resource("project://active", "Currently loaded project configuration", async () => {
    if (!projectConfig) {
      return {
        contents: [{
          uri: "project://active",
          mimeType: "application/json",
          text: JSON.stringify({
            loaded: false,
            message: "No project configuration loaded. Set WINCCOA_PROJECT_INSTRUCTIONS environment variable to load a project."
          }, null, 2)
        }]
      };
    }
    
    return {
      contents: [{
        uri: "project://active",
        mimeType: "application/json",
        text: JSON.stringify({
          loaded: true,
          name: projectConfig.name,
          path: projectConfig.path,
          field: activeFieldName
        }, null, 2)
      }]
    };
  });
  
  // Resource: Project instructions only
  server.resource("project://instructions", "Project-specific instructions only", async () => {
    if (!projectConfig) {
      return {
        contents: [{
          uri: "project://instructions",
          mimeType: "text/plain",
          text: "No project configuration loaded."
        }]
      };
    }
    
    return {
      contents: [{
        uri: "project://instructions",
        mimeType: "text/markdown",
        text: projectConfig.content
      }]
    };
  });
  
  console.log(`Initialized field resources. Active field: ${activeFieldName}`);
  if (projectConfig) {
    console.log(`Project configuration: ${projectConfig.name}`);
  }
}