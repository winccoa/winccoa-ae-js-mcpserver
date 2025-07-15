import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Register datapoint type management tools
 * @param {McpServer} server - MCP server instance
 * @param {Object} context - Server context with winccoa, configs, etc.
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;
  
  server.tool("dp-type-get", "Get structure of a data point type as a tree of nodes.\n" +
      "\ndpt: Data point type name to retrieve structure for\n" +
      "includeSubTypes: Optional flag to include subtypes in the result (default: false)\n" +
      "\nReturns: WinccoaDpTypeNode structure representing the complete hierarchy of the data point type\n" +
      "including all elements, their data types, and structural relationships.", {
    dpType: z.string(),
    withSubTypes: z.boolean().optional(),
  }, async ({ dpType, withSubTypes }) => {
    try {
      const result = winccoa.dpTypeGet(dpType, withSubTypes);
      return createSuccessResponse(result);
    } catch (error) {
      console.error(`Error getting datapoint type ${dpType}:`, error);
      return createErrorResponse(`Failed to get datapoint type ${dpType}: ${error.message}`);
    }
  });
  
  server.tool("dp-type-name", "Returns the data point type for the given data point name.\n" +
      "\ndpName: Name of the data point (for example, 'valve.opening')\n" +
      "\nReturns: DP type as a string, or empty string if data point doesn't exist or error occurs.\n" +
      "\nExample: dpTypeName('Valve17.opening') might return 'AnalogValve'", {
    dpName: z.string(),
  }, async ({ dpName }) => {
    try {
      const result = winccoa.dpTypeName(dpName);
      return createSuccessResponse({ dpName, typeName: result });
    } catch (error) {
      console.error(`Error getting type name for ${dpName}:`, error);
      return createErrorResponse(`Failed to get type name for ${dpName}: ${error.message}`);
    }
  });




  return 3; // Number of tools registered
}