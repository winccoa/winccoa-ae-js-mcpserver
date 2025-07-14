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
  
  server.tool("dp-type-get", "Get datapoint type structure", {
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
  
  server.tool("dp-type-name", "Get datapoint type name for datapoint", {
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
  
  server.tool("dp-type-ref", "Get type reference of datapoint element", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    try {
      const result = winccoa.dpTypeRef(dpeName);
      return createSuccessResponse({ dpeName, typeRef: result });
    } catch (error) {
      console.error(`Error getting type reference for ${dpeName}:`, error);
      return createErrorResponse(`Failed to get type reference for ${dpeName}: ${error.message}`);
    }
  });

  return 3; // Number of tools registered
}